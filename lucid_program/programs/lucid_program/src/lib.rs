use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    pubkey::pubkey,
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use magicblock_magic_program_api::{args::ScheduleTaskArgs, instruction::MagicBlockInstruction};
#[cfg(feature = "oracle")]
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

declare_id!("BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms");

/// TEE validator for Private Ephemeral Rollup (PER). Used as default when no validator account is passed.
pub const TEE_VALIDATOR: Pubkey = pubkey!("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");

/// Discriminator for execute_intent (no args) — from IDL
const EXECUTE_INTENT_DISCRIMINATOR: [u8; 8] = [53, 130, 47, 154, 227, 220, 122, 212];

#[ephemeral]
#[program]
pub mod lucid_program {
    use super::*;

    /// Initialize platform fee config (call once after deploy; only authority can update later)
    pub fn init_fee_config(
        ctx: Context<InitFeeConfig>,
        fee_recipient: Pubkey,
        creation_fee_lamports: u64,
        execution_fee_bps: u16,
    ) -> Result<()> {
        require!(execution_fee_bps <= 10000, ErrorCode::InvalidFeeConfig);
        let config = &mut ctx.accounts.fee_config;
        config.authority = ctx.accounts.authority.key();
        config.fee_recipient = fee_recipient;
        config.creation_fee_lamports = creation_fee_lamports;
        config.execution_fee_bps = execution_fee_bps;
        msg!("Fee config initialized: recipient={:?}, creation_fee={}, execution_bps={}", fee_recipient, creation_fee_lamports, execution_fee_bps);
        Ok(())
    }

    /// Update platform fee config (authority only)
    pub fn update_fee_config(
        ctx: Context<UpdateFeeConfig>,
        creation_fee_lamports: u64,
        execution_fee_bps: u16,
    ) -> Result<()> {
        require!(execution_fee_bps <= 10000, ErrorCode::InvalidFeeConfig);
        let config = &mut ctx.accounts.fee_config;
        require!(config.authority == ctx.accounts.authority.key(), ErrorCode::Unauthorized);
        config.creation_fee_lamports = creation_fee_lamports;
        config.execution_fee_bps = execution_fee_bps;
        msg!("Fee config updated: creation_fee={}, execution_bps={}", creation_fee_lamports, execution_fee_bps);
        Ok(())
    }

    /// Initialize a new Intent Capsule (SOL locked in vault; anyone can execute when conditions are met).
    /// PER: To restrict intent_data access to TEE only, add CPI to Magicblock Permission Program (CreatePermissionGroup / CreatePermission) when available.
    pub fn create_capsule(
        ctx: Context<CreateCapsule>,
        inactivity_period: i64,
        intent_data: Vec<u8>,
    ) -> Result<()> {
        // Parse totalAmount from intent_data to lock SOL in vault
        let total_amount_lamports = {
            let intent_data_str = String::from_utf8(intent_data.clone())
                .map_err(|_| ErrorCode::InvalidIntentData)?;
            let intent_json: serde_json::Value = serde_json::from_str(&intent_data_str)
                .map_err(|_| ErrorCode::InvalidIntentData)?;
            let total_str = intent_json.get("totalAmount")
                .and_then(|t| t.as_str())
                .ok_or(ErrorCode::InvalidIntentData)?;
            parse_sol_to_lamports(total_str).map_err(|_| ErrorCode::InvalidIntentData)?
        };

        let fee_config = &ctx.accounts.fee_config;
        if fee_config.creation_fee_lamports > 0 {
            let platform_recipient = ctx.accounts.platform_fee_recipient.as_mut().ok_or(ErrorCode::InvalidFeeConfig)?;
            require!(platform_recipient.key() == fee_config.fee_recipient, ErrorCode::InvalidFeeConfig);
            let cpi_accounts = system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: platform_recipient.clone(),
            };
            let cpi_program = ctx.accounts.system_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            system_program::transfer(cpi_ctx, fee_config.creation_fee_lamports)?;
            msg!("Creation fee {} lamports sent to platform", fee_config.creation_fee_lamports);
        }

        let capsule = &mut ctx.accounts.capsule;
        capsule.owner = ctx.accounts.owner.key();
        capsule.inactivity_period = inactivity_period;
        capsule.last_activity = Clock::get()?.unix_timestamp;
        capsule.intent_data = intent_data;
        capsule.is_active = true;
        capsule.bump = ctx.bumps.capsule;
        capsule.vault_bump = ctx.bumps.vault;

        // Lock SOL in vault (owner signs; at execution, program signs for vault → beneficiaries)
        let cpi_accounts = system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.system_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        system_program::transfer(cpi_ctx, total_amount_lamports)?;
        msg!("Locked {} lamports in vault for capsule {:?}", total_amount_lamports, capsule.key());

        msg!("Intent Capsule created: {:?}", capsule.key());
        Ok(())
    }

    /// Update the intent data of an existing capsule
    pub fn update_intent(
        ctx: Context<UpdateIntent>,
        new_intent_data: Vec<u8>,
    ) -> Result<()> {
        let capsule = &mut ctx.accounts.capsule;
        require!(capsule.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        require!(capsule.is_active, ErrorCode::CapsuleInactive);
        
        capsule.intent_data = new_intent_data;
        capsule.last_activity = Clock::get()?.unix_timestamp;
        
        msg!("Intent updated for capsule: {:?}", capsule.key());
        Ok(())
    }

    /// Execute the intent when inactivity period is met. Anyone can call (no owner signature required).
    /// SOL is transferred from the capsule vault to platform (fee) and beneficiaries.
    pub fn execute_intent<'info>(
        ctx: Context<'_, '_, '_, 'info, ExecuteIntent<'info>>,
    ) -> Result<()> {
        let capsule = &mut ctx.accounts.capsule;
        require!(capsule.is_active, ErrorCode::CapsuleInactive);
        
        let current_time = Clock::get()?.unix_timestamp;
        let time_since_activity = current_time - capsule.last_activity;
        
        require!(
            time_since_activity >= capsule.inactivity_period,
            ErrorCode::InactivityPeriodNotMet
        );
        
        // Parse intent data
        let intent_data_str = String::from_utf8(capsule.intent_data.clone())
            .map_err(|_| ErrorCode::InvalidIntentData)?;
        let intent_json: serde_json::Value = serde_json::from_str(&intent_data_str)
            .map_err(|_| ErrorCode::InvalidIntentData)?;
        
        let beneficiaries = intent_json.get("beneficiaries")
            .and_then(|b| b.as_array())
            .ok_or(ErrorCode::InvalidIntentData)?;
        
        let total_amount_str = intent_json.get("totalAmount")
            .and_then(|t| t.as_str())
            .ok_or(ErrorCode::InvalidIntentData)?;
        
        let total_amount_lamports = parse_sol_to_lamports(total_amount_str)
            .map_err(|_| ErrorCode::InvalidIntentData)?;
        
        let vault_bump = capsule.vault_bump;
        let owner_key = capsule.owner;
        let vault_seeds: &[&[u8]] = &[
            b"capsule_vault",
            owner_key.as_ref(),
            &[vault_bump],
        ];
        let signer_seeds = &[vault_seeds];
        
        // Platform execution fee (from vault)
        let fee_config = &ctx.accounts.fee_config;
        let mut remaining_for_beneficiaries = total_amount_lamports;
        if fee_config.execution_fee_bps > 0 {
            let execution_fee = (total_amount_lamports as u64)
                .checked_mul(fee_config.execution_fee_bps as u64)
                .and_then(|v| v.checked_div(10_000))
                .ok_or(ErrorCode::InvalidIntentData)?;
            if execution_fee > 0 {
                let platform_recipient = ctx.accounts.platform_fee_recipient.as_mut().ok_or(ErrorCode::InvalidFeeConfig)?;
                require!(platform_recipient.key() == fee_config.fee_recipient, ErrorCode::InvalidFeeConfig);
                let cpi_accounts = system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: platform_recipient.clone(),
                };
                let cpi_program = ctx.accounts.system_program.to_account_info();
                let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
                system_program::transfer(cpi_ctx, execution_fee)?;
                remaining_for_beneficiaries = total_amount_lamports.saturating_sub(execution_fee);
                msg!("Execution fee {} lamports sent to platform", execution_fee);
            }
        }
        
        // Distribute SOL from vault to each beneficiary (proportional if fee was taken)
        let total_for_ratio = total_amount_lamports;
        let mut distributed: u64 = 0;
        let beneficiary_count = beneficiaries.len();
        for (idx, beneficiary) in beneficiaries.iter().enumerate() {
            let address_str = beneficiary.get("address")
                .and_then(|a| a.as_str())
                .ok_or(ErrorCode::InvalidIntentData)?;
            
            let beneficiary_pubkey = address_str.parse::<Pubkey>()
                .map_err(|_| ErrorCode::InvalidBeneficiaryAddress)?;
            
            let amount_str = beneficiary.get("amount")
                .and_then(|a| a.as_str())
                .ok_or(ErrorCode::InvalidIntentData)?;
            
            let amount_type = beneficiary.get("amountType")
                .and_then(|t| t.as_str())
                .unwrap_or("fixed");
            
            let amount_lamports = if amount_type == "percentage" {
                let percentage = amount_str.parse::<f64>()
                    .map_err(|_| ErrorCode::InvalidIntentData)?;
                (total_amount_lamports as f64 * percentage / 100.0) as u64
            } else {
                parse_sol_to_lamports(amount_str)
                    .map_err(|_| ErrorCode::InvalidIntentData)?
            };
            
            // Proportional amount after execution fee (last beneficiary gets remainder to avoid dust)
            let to_send = if total_for_ratio == 0 {
                0u64
            } else if idx == beneficiary_count.saturating_sub(1) {
                remaining_for_beneficiaries.saturating_sub(distributed)
            } else {
                (amount_lamports as u64)
                    .checked_mul(remaining_for_beneficiaries)
                    .and_then(|v| v.checked_div(total_for_ratio))
                    .unwrap_or(0)
            };
            distributed = distributed.saturating_add(to_send);
            
            if to_send > 0 {
                let beneficiary_account = ctx.remaining_accounts
                    .iter()
                    .find(|acc| acc.key() == beneficiary_pubkey)
                    .ok_or(ErrorCode::InvalidBeneficiaryAddress)?;
                
                let cpi_accounts = system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: beneficiary_account.clone(),
                };
                let cpi_program = ctx.accounts.system_program.to_account_info();
                let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
                system_program::transfer(cpi_ctx, to_send)?;
                msg!("Transferred {} lamports to beneficiary: {}", to_send, beneficiary_pubkey);
            }
        }
        
        capsule.is_active = false;
        capsule.executed_at = Some(current_time);
        
        msg!("Intent executed for capsule: {:?} (anyone could trigger)", capsule.key());
        emit!(IntentExecuted {
            capsule: capsule.key(),
            owner: capsule.owner,
            executed_at: current_time,
        });
        
        Ok(())
    }

    /// Update last activity timestamp (called by Helius webhook or user)
    pub fn update_activity(ctx: Context<UpdateActivity>) -> Result<()> {
        let capsule = &mut ctx.accounts.capsule;
        require!(capsule.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        
        capsule.last_activity = Clock::get()?.unix_timestamp;
        
        msg!("Activity updated for capsule: {:?}", capsule.key());
        Ok(())
    }

    /// Deactivate a capsule (owner can cancel before execution)
    pub fn deactivate_capsule(ctx: Context<DeactivateCapsule>) -> Result<()> {
        let capsule = &mut ctx.accounts.capsule;
        require!(capsule.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        require!(capsule.is_active, ErrorCode::CapsuleInactive);
        
        capsule.is_active = false;
        
        msg!("Capsule deactivated: {:?}", capsule.key());
        Ok(())
    }

    /// Delegate capsule PDA to Magicblock ER/PER. When no validator is passed, defaults to TEE validator (PER).
    pub fn delegate_capsule(ctx: Context<DelegateCapsuleInput>) -> Result<()> {
        let owner_key = ctx.accounts.owner.key();
        let pda_seeds: &[&[u8]] = &[b"intent_capsule", owner_key.as_ref()];
        let validator_pubkey = ctx
            .accounts
            .validator
            .as_ref()
            .map(|a| a.key())
            .or(Some(TEE_VALIDATOR));
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            pda_seeds,
            DelegateConfig {
                validator: validator_pubkey,
                ..Default::default()
            },
        )?;
        msg!("Capsule delegated to Ephemeral Rollup (validator: {:?}): {:?}", validator_pubkey, ctx.accounts.pda.key());
        Ok(())
    }

    /// Commit and undelegate capsule from Ephemeral Rollup back to Solana base layer (e.g. after execution)
    pub fn undelegate_capsule(ctx: Context<UndelegateCapsuleInput>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.capsule.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        msg!("Capsule undelegated from Ephemeral Rollup: {:?}", ctx.accounts.capsule.key());
        Ok(())
    }

    /// Schedule crank to run execute_intent at intervals (Magicblock ScheduleTask).
    /// Anyone can execute when conditions are met; this registers the task for the crank.
    pub fn schedule_execute_intent(
        ctx: Context<ScheduleExecuteIntent>,
        args: ScheduleExecuteIntentArgs,
    ) -> Result<()> {
        let execute_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new(ctx.accounts.capsule.key(), false),
                AccountMeta::new(ctx.accounts.vault.key(), false),
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.fee_config.key(), false),
                AccountMeta::new(ctx.accounts.platform_fee_recipient.key(), false),
            ],
            data: EXECUTE_INTENT_DISCRIMINATOR.to_vec(),
        };

        let ix_data = bincode::serialize(&MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
            task_id: args.task_id,
            execution_interval_millis: args.execution_interval_millis,
            iterations: args.iterations,
            instructions: vec![execute_ix],
        }))
        .map_err(|e| {
            msg!("ERROR: failed to serialize ScheduleTask args: {:?}", e);
            ErrorCode::InvalidInstructionData
        })?;

        let schedule_ix = Instruction::new_with_bytes(
            MAGIC_PROGRAM_ID,
            &ix_data,
            vec![
                AccountMeta::new(ctx.accounts.payer.key(), true),
                AccountMeta::new(ctx.accounts.capsule.key(), false),
            ],
        );

        invoke_signed(
            &schedule_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.capsule.to_account_info(),
            ],
            &[],
        )?;

        msg!("Scheduled execute_intent crank: task_id={}", args.task_id);
        Ok(())
    }

    /// Read and log SOL/USD (or other) price from Pyth Lazer / ephemeral oracle price feed (for gating or monitoring).
    /// Enable feature "oracle" and pass a Pyth Lazer price feed account (e.g. SOL/USD on Magicblock devnet).
    pub fn sample_price(ctx: Context<SamplePrice>) -> Result<()> {
        #[cfg(feature = "oracle")]
        {
            let data_ref = ctx.accounts.price_update.data.borrow();
            let price_update = PriceUpdateV2::try_deserialize_unchecked(&mut data_ref.as_ref())
                .map_err(|_| ErrorCode::InvalidPriceFeed)?;

            let maximum_age_secs: u64 = 60;
            let feed_id: [u8; 32] = ctx.accounts.price_update.key().to_bytes();
            let price = price_update
                .get_price_no_older_than(&Clock::get()?, maximum_age_secs, &feed_id)
                .map_err(|_| ErrorCode::InvalidPriceFeed)?;

            msg!(
                "Price ({} ± {}) * 10^-{}",
                price.price,
                price.conf,
                price.exponent
            );
            msg!(
                "Price value: {}",
                price.price as f64 * 10_f64.powi(-price.exponent)
            );
        }
        #[cfg(not(feature = "oracle"))]
        {
            let _ = ctx;
            msg!("Oracle feature disabled; enable with --features oracle and pass Pyth Lazer price feed account.");
        }
        Ok(())
    }

    /// Recreate a capsule from executed state (owner locks new SOL in vault)
    pub fn recreate_capsule(
        ctx: Context<RecreateCapsule>,
        inactivity_period: i64,
        intent_data: Vec<u8>,
    ) -> Result<()> {
        let capsule = &mut ctx.accounts.capsule;
        require!(capsule.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        require!(!capsule.is_active, ErrorCode::CapsuleActive);
        require!(capsule.executed_at.is_some(), ErrorCode::CapsuleNotExecuted);
        
        let total_amount_lamports = {
            let intent_data_str = String::from_utf8(intent_data.clone())
                .map_err(|_| ErrorCode::InvalidIntentData)?;
            let intent_json: serde_json::Value = serde_json::from_str(&intent_data_str)
                .map_err(|_| ErrorCode::InvalidIntentData)?;
            let total_str = intent_json.get("totalAmount")
                .and_then(|t| t.as_str())
                .ok_or(ErrorCode::InvalidIntentData)?;
            parse_sol_to_lamports(total_str).map_err(|_| ErrorCode::InvalidIntentData)?
        };
        
        capsule.inactivity_period = inactivity_period;
        capsule.last_activity = Clock::get()?.unix_timestamp;
        capsule.intent_data = intent_data;
        capsule.is_active = true;
        capsule.executed_at = None;
        
        // Lock new SOL in vault (owner signs)
        let cpi_accounts = system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.system_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        system_program::transfer(cpi_ctx, total_amount_lamports)?;
        msg!("Locked {} lamports in vault for recreated capsule {:?}", total_amount_lamports, capsule.key());
        
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ScheduleExecuteIntentArgs {
    pub task_id: u64,
    pub execution_interval_millis: u64,
    pub iterations: u64,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateCapsuleInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    /// CHECK: Checked by the delegation program
    pub validator: Option<AccountInfo<'info>>,
    /// CHECK: PDA to delegate (capsule); #[delegate] expects field name "pda"
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateCapsuleInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    /// CHECK: used for CPI
    pub magic_context: AccountInfo<'info>,
    /// CHECK: Magic program
    pub magic_program: AccountInfo<'info>,
    #[account(mut, seeds = [b"intent_capsule", owner.key().as_ref()], bump = capsule.bump)]
    pub capsule: Account<'info, IntentCapsule>,
}

#[derive(Accounts)]
pub struct ScheduleExecuteIntent<'info> {
    /// CHECK: Magic program for CPI
    pub magic_program: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"intent_capsule", owner.key().as_ref()], bump = capsule.bump)]
    pub capsule: Account<'info, IntentCapsule>,
    #[account(mut, seeds = [b"capsule_vault", owner.key().as_ref()], bump = capsule.vault_bump)]
    pub vault: Account<'info, CapsuleVault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(seeds = [b"fee_config"], bump)]
    pub fee_config: Account<'info, FeeConfig>,
    /// CHECK: platform fee recipient (optional; validated in execute_intent)
    #[account(mut)]
    pub platform_fee_recipient: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct SamplePrice<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Pyth Lazer / ephemeral oracle price feed account
    pub price_update: AccountInfo<'info>,
}

#[account]
pub struct FeeConfig {
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub creation_fee_lamports: u64,
    pub execution_fee_bps: u16, // basis points, 10000 = 100%
}

impl FeeConfig {
    pub const LEN: usize = 32 + 32 + 8 + 2;
}

#[derive(Accounts)]
pub struct InitFeeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + FeeConfig::LEN,
        seeds = [b"fee_config"],
        bump
    )]
    pub fee_config: Account<'info, FeeConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateFeeConfig<'info> {
    #[account(
        mut,
        seeds = [b"fee_config"],
        bump,
        constraint = fee_config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub fee_config: Account<'info, FeeConfig>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateCapsule<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + IntentCapsule::LEN,
        seeds = [b"intent_capsule", owner.key().as_ref()],
        bump
    )]
    pub capsule: Account<'info, IntentCapsule>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + CapsuleVault::LEN,
        seeds = [b"capsule_vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, CapsuleVault>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(seeds = [b"fee_config"], bump)]
    pub fee_config: Account<'info, FeeConfig>,
    
    /// Platform fee recipient (must match fee_config.fee_recipient when creation_fee_lamports > 0)
    /// CHECK: validated against fee_config.fee_recipient in instruction
    #[account(mut)]
    pub platform_fee_recipient: Option<AccountInfo<'info>>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateIntent<'info> {
    #[account(
        mut,
        seeds = [b"intent_capsule", owner.key().as_ref()],
        bump = capsule.bump
    )]
    pub capsule: Account<'info, IntentCapsule>,
    
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteIntent<'info> {
    #[account(
        mut,
        seeds = [b"intent_capsule", capsule.owner.as_ref()],
        bump = capsule.bump
    )]
    pub capsule: Account<'info, IntentCapsule>,
    
    #[account(
        mut,
        seeds = [b"capsule_vault", capsule.owner.as_ref()],
        bump = capsule.vault_bump
    )]
    pub vault: Account<'info, CapsuleVault>,
    
    pub system_program: Program<'info, System>,
    
    #[account(seeds = [b"fee_config"], bump)]
    pub fee_config: Account<'info, FeeConfig>,
    
    /// Platform fee recipient (must match fee_config.fee_recipient when execution_fee_bps > 0)
    /// CHECK: validated against fee_config.fee_recipient in instruction
    #[account(mut)]
    pub platform_fee_recipient: Option<AccountInfo<'info>>,
}

#[derive(Accounts)]
pub struct UpdateActivity<'info> {
    #[account(
        mut,
        seeds = [b"intent_capsule", owner.key().as_ref()],
        bump = capsule.bump
    )]
    pub capsule: Account<'info, IntentCapsule>,
    
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeactivateCapsule<'info> {
    #[account(
        mut,
        seeds = [b"intent_capsule", owner.key().as_ref()],
        bump = capsule.bump
    )]
    pub capsule: Account<'info, IntentCapsule>,
    
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct RecreateCapsule<'info> {
    #[account(
        mut,
        seeds = [b"intent_capsule", owner.key().as_ref()],
        bump = capsule.bump
    )]
    pub capsule: Account<'info, IntentCapsule>,
    
    #[account(
        mut,
        seeds = [b"capsule_vault", owner.key().as_ref()],
        bump = capsule.vault_bump
    )]
    pub vault: Account<'info, CapsuleVault>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

/// Vault PDA holds SOL locked at capsule creation; anyone can trigger execute when conditions are met.
#[account]
pub struct CapsuleVault {
    pub dummy: u8, // placeholder for account discriminator + minimal data
}

impl CapsuleVault {
    pub const LEN: usize = 1;
}

#[account]
pub struct IntentCapsule {
    pub owner: Pubkey,
    pub inactivity_period: i64, // seconds
    pub last_activity: i64,      // unix timestamp
    pub intent_data: Vec<u8>,    // encoded intent instructions
    pub is_active: bool,
    pub executed_at: Option<i64>,
    pub bump: u8,
    pub vault_bump: u8, // for invoke_signed when transferring from vault
}

impl IntentCapsule {
    pub const LEN: usize = 32 + // owner
        8 +                      // inactivity_period
        8 +                      // last_activity
        4 + 1024 +               // intent_data (max 1KB)
        1 +                      // is_active
        1 + 8 +                  // executed_at (Option<i64>)
        1 +                      // bump
        1;                       // vault_bump
}

#[event]
pub struct IntentExecuted {
    pub capsule: Pubkey,
    pub owner: Pubkey,
    pub executed_at: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized: Only the owner can perform this action")]
    Unauthorized,
    #[msg("Capsule is not active")]
    CapsuleInactive,
    #[msg("Capsule is active")]
    CapsuleActive,
    #[msg("Capsule has not been executed")]
    CapsuleNotExecuted,
    #[msg("Inactivity period has not been met")]
    InactivityPeriodNotMet,
    #[msg("Invalid intent data format")]
    InvalidIntentData,
    #[msg("Invalid beneficiary address")]
    InvalidBeneficiaryAddress,
    #[msg("Invalid instruction data for crank")]
    InvalidInstructionData,
    #[msg("Invalid or stale price feed")]
    InvalidPriceFeed,
    #[msg("Invalid fee config or fee recipient")]
    InvalidFeeConfig,
}

/// Parse SOL amount string to lamports
fn parse_sol_to_lamports(sol_str: &str) -> Result<u64> {
    let sol_amount: f64 = sol_str.parse()
        .map_err(|_| ErrorCode::InvalidIntentData)?;
    
    // Convert SOL to lamports (1 SOL = 1_000_000_000 lamports)
    let lamports = (sol_amount * 1_000_000_000.0) as u64;
    Ok(lamports)
}
