#!/bin/bash
# Complete deployment script for Solana devnet with all prerequisites
# This script installs Rust, Solana CLI, Anchor, and deploys the contract

set -e

echo "=== Lucid Solana Program Complete Deployment ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}??{NC} $1"
}

print_error() {
    echo -e "${RED}??{NC} $1"
}

print_info() {
    echo -e "${YELLOW}??{NC} $1"
}

# Step 1: Install Rust if not installed
print_info "Step 1: Checking Rust installation..."
if ! command -v rustc &> /dev/null; then
    print_info "Rust not found. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
    print_success "Rust installed successfully"
else
    print_success "Rust is already installed"
    rustc --version
fi

# Ensure cargo is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Step 2: Install Solana CLI if not installed
print_info "Step 2: Checking Solana CLI installation..."
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

if ! command -v solana &> /dev/null; then
    print_info "Solana CLI not found. Installing Solana CLI..."
    if sh -c "$(curl -sSfL https://release.solana.com/stable/install)"; then
        export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
        print_success "Solana CLI installed successfully"
    else
        print_error "Failed to install Solana CLI. Please install manually:"
        echo "  sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
        echo "  export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\""
        exit 1
    fi
else
    print_success "Solana CLI is already installed"
fi

# Verify solana is accessible
if command -v solana &> /dev/null; then
    solana --version
else
    print_error "Solana CLI is not in PATH. Please add it:"
    echo "  export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\""
    exit 1
fi
echo ""

# Step 3: Install Anchor if not installed
print_info "Step 3: Checking Anchor installation..."
if ! command -v anchor &> /dev/null; then
    print_info "Anchor not found. Installing Anchor..."
    cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
    export PATH="$HOME/.cargo/bin:$PATH"
    avm install latest
    avm use latest
    print_success "Anchor installed successfully"
else
    print_success "Anchor is already installed"
fi

anchor --version
echo ""

# Step 4: Navigate to program directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/lucid_program"
print_info "Working directory: $(pwd)"
echo ""

# Step 5: Configure for devnet and check/create keypair
print_info "Step 5: Configuring for devnet..."
solana config set --url devnet

# Check if default keypair exists
if [ ! -f "$HOME/.config/solana/id.json" ]; then
    print_info "Default keypair not found."
    echo ""
    print_info "Choose an option:"
    echo "  1) Create a new keypair"
    echo "  2) Restore from seed phrase"
    read -p "Enter choice (1 or 2): " KEYPAIR_CHOICE
    
    if [ "$KEYPAIR_CHOICE" = "2" ]; then
        print_info "Restoring keypair from seed phrase..."
        solana-keygen recover prompt:// -o "$HOME/.config/solana/id.json" --force
        print_success "Keypair restored from seed phrase"
    else
        print_info "Creating a new keypair..."
        solana-keygen new -o "$HOME/.config/solana/id.json" --no-bip39-passphrase
        print_success "New keypair created"
        print_info "IMPORTANT: Save your seed phrase shown above!"
    fi
else
    CURRENT_ADDRESS=$(solana address 2>&1)
    print_success "Default keypair found"
    print_info "Current address: $CURRENT_ADDRESS"
    echo ""
    print_info "Do you want to reset the keypair?"
    echo "  1) Keep current keypair"
    echo "  2) Create a new keypair (backup current first)"
    echo "  3) Restore from seed phrase (backup current first)"
    read -p "Enter choice (1, 2, or 3): " RESET_CHOICE
    
    if [ "$RESET_CHOICE" = "2" ]; then
        BACKUP_FILE="$HOME/.config/solana/id.json.backup.$(date +%Y%m%d_%H%M%S)"
        print_info "Backing up current keypair to: $BACKUP_FILE"
        cp "$HOME/.config/solana/id.json" "$BACKUP_FILE"
        print_success "Backup created"
        echo ""
        print_info "Creating a new keypair..."
        solana-keygen new -o "$HOME/.config/solana/id.json" --no-bip39-passphrase
        print_success "New keypair created"
        print_info "IMPORTANT: Save your seed phrase shown above!"
        echo ""
        NEW_ADDRESS=$(solana address 2>&1)
        print_info "New address: $NEW_ADDRESS"
    elif [ "$RESET_CHOICE" = "3" ]; then
        BACKUP_FILE="$HOME/.config/solana/id.json.backup.$(date +%Y%m%d_%H%M%S)"
        print_info "Backing up current keypair to: $BACKUP_FILE"
        cp "$HOME/.config/solana/id.json" "$BACKUP_FILE"
        print_success "Backup created"
        echo ""
        print_info "Restoring keypair from seed phrase..."
        # Remove existing keypair before restore (or use --force flag)
        rm "$HOME/.config/solana/id.json"
        solana-keygen recover prompt:// -o "$HOME/.config/solana/id.json"
        print_success "Keypair restored from seed phrase"
        echo ""
        RESTORED_ADDRESS=$(solana address 2>&1)
        print_info "Restored address: $RESTORED_ADDRESS"
    else
        print_info "Keeping current keypair"
    fi
fi
echo ""

# Step 6: Check balance and airdrop
print_info "Step 6: Checking SOL balance..."
BALANCE_OUTPUT=$(solana balance 2>&1)
echo "$BALANCE_OUTPUT"

if echo "$BALANCE_OUTPUT" | grep -q "SOL"; then
    BALANCE=$(echo "$BALANCE_OUTPUT" | grep -oE '[0-9]+\.[0-9]+' | head -1)
    if [ -z "$BALANCE" ] || (( $(echo "$BALANCE < 2" | bc -l 2>/dev/null || echo "1") )); then
        print_info "Balance is low. Requesting airdrop of 2 SOL..."
        solana airdrop 2
        sleep 5
        print_success "Airdrop received"
        echo "New balance:"
        solana balance
    else
        print_success "Balance is sufficient: $BALANCE SOL"
    fi
else
    print_info "No balance found. Requesting airdrop of 2 SOL..."
    solana airdrop 2
    sleep 5
    print_success "Airdrop received"
    echo "New balance:"
    solana balance
fi
echo ""

# Step 7: Clean previous build (to avoid fallback function conflicts)
print_info "Step 7: Cleaning previous build..."
anchor clean
echo ""

# Step 8: Build the program
print_info "Step 8: Building program..."
if anchor build; then
    print_success "Build successful!"
else
    print_error "Build failed!"
    exit 1
fi
echo ""

# Step 9: Deploy the program
print_info "Step 9: Deploying to devnet..."
if anchor deploy; then
    echo ""
    print_success "=== Deployment successful! ==="
    echo ""
    
    # Step 10: Update IDL file
    print_info "Step 10: Updating IDL file..."
    if [ -f "target/idl/lucid_program.json" ]; then
        cp target/idl/lucid_program.json "$SCRIPT_DIR/idl/lucid_program.json"
        print_success "IDL file updated successfully!"
    else
        print_error "IDL file not found in target/idl/"
    fi
    echo ""
    
    # Get program ID
    PROGRAM_ID=$(solana address -k target/deploy/lucid_program-keypair.json)
    echo "Program ID: $PROGRAM_ID"
    echo ""
    print_info "Please update your .env.local file with:"
    echo "NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID"
    echo ""
    
    print_info "Note: Program ID is BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms"
else
    echo ""
    print_error "Deployment failed!"
    exit 1
fi
