use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use magicblock_magic_program_api::{args::ScheduleTaskArgs, instruction::MagicBlockInstruction};
#[cfg(feature = "oracle")]
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

declare_id!("BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms");

/// Discriminator for execute_intent (no args) — from IDL
const EXECUTE_INTENT_DISCRIMINATOR: [u8; 8] = [53, 130, 47, 154, 227, 220, 122, 212];

#[ephemeral]
#[program]
pub mod lucid_program {
    use super::*;

    /// Initialize a new Intent Capsule
    pub fn create_capsule(
        ctx: Context<CreateCapsule>,
        inactivity_period: i64,
        intent_data: Vec<u8>,
    ) -> Result<()> {
        let capsule = &mut ctx.accounts.capsule;
        capsule.owner = ctx.accounts.owner.key();
        capsule.inactivity_period = inactivity_period;
        capsule.last_activity = Clock::get()?.unix_timestamp;
        capsule.intent_data = intent_data;
        capsule.is_active = true;
        capsule.bump = ctx.bumps.capsule;
        
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

    /// Execute the intent when inactivity period is met (Magicblock ER private monitoring triggers via Magic Action)
    pub fn execute_intent<'info>(
        ctx: Context<'_, '_, '_, 'info, ExecuteIntent<'info>>,
    ) -> Result<()> {
        let capsule = &mut ctx.accounts.capsule;
        require!(capsule.is_active, ErrorCode::CapsuleInactive);
        
        // Require that executor is the owner (for SOL transfers, owner must sign)
        require!(
            ctx.accounts.executor.key() == capsule.owner && ctx.accounts.executor.key() == ctx.accounts.owner.key(),
            ErrorCode::Unauthorized
        );
        
        let current_time = Clock::get()?.unix_timestamp;
        let time_since_activity = current_time - capsule.last_activity;
        
        require!(
            time_since_activity >= capsule.inactivity_period,
            ErrorCode::InactivityPeriodNotMet
        );
        
        // Conditions verified (privately in Magicblock ER; execution triggered via Magic Action on Devnet)
        
        // Parse intent data to extract beneficiaries and amounts
        // Intent data is stored as JSON: {"intent": "...", "beneficiaries": [...], "totalAmount": "..."}
        let intent_data_str = String::from_utf8(capsule.intent_data.clone())
            .map_err(|_| ErrorCode::InvalidIntentData)?;
        
        // Parse JSON to extract beneficiaries
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
        
        // Distribute SOL to each beneficiary
        for beneficiary in beneficiaries {
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
            
            // Calculate amount in lamports
            let amount_lamports = if amount_type == "percentage" {
                let percentage = amount_str.parse::<f64>()
                    .map_err(|_| ErrorCode::InvalidIntentData)?;
                (total_amount_lamports as f64 * percentage / 100.0) as u64
            } else {
                parse_sol_to_lamports(amount_str)
                    .map_err(|_| ErrorCode::InvalidIntentData)?
            };
            
            // Transfer SOL from owner to beneficiary
            // Use remaining_accounts to find the beneficiary account
            if amount_lamports > 0 {
                // Find beneficiary account in remaining_accounts
                // remaining_accounts items are already AccountInfo<'info>
                let beneficiary_account = ctx.remaining_accounts
                    .iter()
                    .find(|acc| acc.key() == beneficiary_pubkey)
                    .ok_or(ErrorCode::InvalidBeneficiaryAddress)?;
                
                // Create CPI context - use references directly with explicit lifetime
                let cpi_accounts = system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: beneficiary_account.clone(),
                };
                let cpi_program = ctx.accounts.system_program.to_account_info();
                let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
                
                system_program::transfer(cpi_ctx, amount_lamports)?;
                
                msg!("Transferred {} lamports ({} SOL) to beneficiary: {}", 
                     amount_lamports, 
                     amount_lamports as f64 / 1_000_000_000.0,
                     beneficiary_pubkey);
            }
        }
        
        // Mark capsule as executed
        capsule.is_active = false;
        capsule.executed_at = Some(current_time);
        
        msg!("Intent executed for capsule: {:?}", capsule.key());
        msg!("Time since last activity: {} seconds", time_since_activity);
        
        // Emit event for off-chain monitoring
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

    /// Delegate capsule PDA to Magicblock ER for private monitoring (conditions checked in ER)
    pub fn delegate_capsule(ctx: Context<DelegateCapsuleInput>) -> Result<()> {
        let owner_key = ctx.accounts.owner.key();
        let pda_seeds: &[&[u8]] = &[b"intent_capsule", owner_key.as_ref()];
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            pda_seeds,
            DelegateConfig {
                validator: ctx.accounts.validator.as_ref().map(|a| a.key()),
                ..Default::default()
            },
        )?;
        msg!("Capsule delegated to Ephemeral Rollup: {:?}", ctx.accounts.pda.key());
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
    /// Owner must still sign the actual execution tx when the crank runs; this only registers the task.
    pub fn schedule_execute_intent(
        ctx: Context<ScheduleExecuteIntent>,
        args: ScheduleExecuteIntentArgs,
    ) -> Result<()> {
        let execute_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new(ctx.accounts.capsule.key(), false),
                AccountMeta::new(ctx.accounts.owner.key(), true),
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.executor.key(), false),
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

    /// Recreate a capsule from executed state (allows creating new capsule after execution)
    pub fn recreate_capsule(
        ctx: Context<RecreateCapsule>,
        inactivity_period: i64,
        intent_data: Vec<u8>,
    ) -> Result<()> {
        let capsule = &mut ctx.accounts.capsule;
        require!(capsule.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        require!(!capsule.is_active, ErrorCode::CapsuleActive);
        require!(capsule.executed_at.is_some(), ErrorCode::CapsuleNotExecuted);
        
        // Reset capsule to active state with new data
        capsule.inactivity_period = inactivity_period;
        capsule.last_activity = Clock::get()?.unix_timestamp;
        capsule.intent_data = intent_data;
        capsule.is_active = true;
        capsule.executed_at = None; // Clear executed_at to allow new execution
        
        msg!("Capsule recreated from executed state: {:?}", capsule.key());
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
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
    /// Executor (must be owner when crank runs execute_intent)
    pub executor: Signer<'info>,
}

#[derive(Accounts)]
pub struct SamplePrice<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Pyth Lazer / ephemeral oracle price feed account
    pub price_update: AccountInfo<'info>,
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
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
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
    
    /// Owner's account (must be mut and signer for SOL transfers)
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    
    /// Executor must be the owner (for SOL transfers, owner must sign)
    pub executor: Signer<'info>,
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
    
    pub owner: Signer<'info>,
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
}

impl IntentCapsule {
    pub const LEN: usize = 32 + // owner
        8 +                      // inactivity_period
        8 +                      // last_activity
        4 + 1024 +               // intent_data (max 1KB)
        1 +                      // is_active
        1 + 8 +                  // executed_at (Option<i64>)
        1;                       // bump
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
}

/// Parse SOL amount string to lamports
fn parse_sol_to_lamports(sol_str: &str) -> Result<u64> {
    let sol_amount: f64 = sol_str.parse()
        .map_err(|_| ErrorCode::InvalidIntentData)?;
    
    // Convert SOL to lamports (1 SOL = 1_000_000_000 lamports)
    let lamports = (sol_amount * 1_000_000_000.0) as u64;
    Ok(lamports)
}
