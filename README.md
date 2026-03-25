# Solidity Solang Dapp

A minimal Solang + Soroban demo that pairs a Solidity contract with a SolidJS frontend that auto-generates a contract UI from the deployed contract interface.

## Repo Layout
- `solidity-contracts/` – Solidity sources compiled with Solang (Soroban target)
- `solang-template-solid/` – SolidJS UI, deployment scripts, generated bindings

## Prerequisites
- Node.js
- Stellar CLI (`stellar`) with Soroban support
- Solang compiler installed and on PATH

## Quick Start
1. Install frontend deps
```bash
cd solang-template-solid
npm install
```

2. Configure `.env`
```bash
# solang-template-solid/.env
PUBLIC_STELLAR_NETWORK="testnet"
PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
PUBLIC_STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
PUBLIC_STELLAR_ACCOUNT="test1"

PUBLIC_STELLAR_CONTRACT_PATH="../solidity-contracts/newcontract"
PUBLIC_SOLANG_SOURCE="contract.sol"
PUBLIC_SOLANG_OUTDIR="build"

PUBLIC_SOLANG_COMPILE_COMMAND='solang compile --target soroban --output "build" "contract.sol"'
```

3. Build, deploy, and generate bindings
```bash
node initialize.js
```

4. Run the app
```bash
npm run dev
```

## Contract
The example contract is in:
- `solidity-contracts/newcontract/contract.sol`

## Notes
- If you update the Solidity contract, re-run `node initialize.js` to rebuild, redeploy, and regenerate bindings.
