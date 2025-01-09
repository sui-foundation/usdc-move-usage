import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { SuiTransactionBlockResponse, OwnedObjectRef, BalanceChange as SuiBalanceChange, SuiObjectChange } from '@mysten/sui/client';
const chalk = require('chalk');
 
require('dotenv').config();

// use getFullnodeUrl to define Devnet RPC location
const rpcUrl = getFullnodeUrl('testnet');
 
// create a client connected to devnet
const client = new SuiClient({ url: rpcUrl });

function prettyPrintTransactionResult(res: SuiTransactionBlockResponse) {
  console.log('\n' + chalk.bold.blue('Transaction Result') + '\n');

  // Transaction Status
  console.log(chalk.bold('Status:'), res.effects?.status?.status === 'success' 
    ? chalk.green(res.effects?.status?.status)
    : chalk.red(res.effects?.status?.status));
  
  // Gas Usage
  if (res.effects?.gasUsed) {
    console.log(chalk.bold('\nGas Usage:'));
    console.log('  Computation Cost:', chalk.yellow(res.effects.gasUsed.computationCost), 'MIST');
    console.log('  Storage Cost:', chalk.yellow(res.effects.gasUsed.storageCost), 'MIST');
    console.log('  Storage Rebate:', chalk.green(res.effects.gasUsed.storageRebate), 'MIST');
  }
  
  // Created Objects
  if (res.effects?.created && res.effects.created.length > 0) {
    console.log(chalk.bold('\nCreated Objects:'));
    res.effects.created.forEach((obj: OwnedObjectRef) => {
      console.log('  ID:', chalk.cyan(obj.reference.objectId));
      
      // Get object type from changes
      const objChange = res.objectChanges?.find(change => {
        if ('objectId' in change) {
          return change.objectId === obj.reference.objectId;
        }
        return false;
      });
      
      const objectType = objChange && 'objectType' in objChange ? objChange.objectType : 'Unknown';
      console.log('  Type:', chalk.yellow(objectType));
      
      let ownerAddress = 'Unknown';
      if (typeof obj.owner === 'object' && obj.owner !== null) {
        if ('AddressOwner' in obj.owner) {
          ownerAddress = obj.owner.AddressOwner;
        } else if ('ObjectOwner' in obj.owner) {
          ownerAddress = obj.owner.ObjectOwner;
        }
      }
      console.log('  Owner:', chalk.magenta(ownerAddress));
      console.log();
    });
  }

  // Balance Changes
  if (res.balanceChanges && res.balanceChanges.length > 0) {
    console.log(chalk.bold('\nBalance Changes:'));
    res.balanceChanges.forEach((change: SuiBalanceChange) => {
      const amount = BigInt(change.amount);
      const color = amount < 0n ? chalk.red : chalk.green;
      const coinType = change.coinType.split('::').pop();
      
      let ownerAddress = 'Unknown';
      if (typeof change.owner === 'object' && change.owner !== null) {
        if ('AddressOwner' in change.owner) {
          ownerAddress = change.owner.AddressOwner;
        } else if ('ObjectOwner' in change.owner) {
          ownerAddress = change.owner.ObjectOwner;
        }
      }
      
      const shortAddress = ownerAddress !== 'Unknown' 
        ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}`
        : ownerAddress;
      
      console.log('  ', color(`${change.amount} ${coinType}`),
        chalk.gray(`(${shortAddress})`));
    });
  }
}

export function getSignerFromEnv() {
  let keypair = Ed25519Keypair.fromSecretKey(process.env.PRIVATE_KEY!);
  return keypair;
}

async function main() {
  const keypair = getSignerFromEnv();

  const tx = new Transaction();

  const [sword] = tx.moveCall({
    target: '0xcbbf37a851ed7b625731ca497e2d4aea18cf18145fac3b78bd64f274f6a09d30::usdc_usage::buy_sword_with_usdc', 
    arguments: [
      coinWithBalance({
        type: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
        balance: 1
      })
    ]
  });

  tx.transferObjects([sword], keypair.toSuiAddress());

  const res = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEvents: true,
      showObjectChanges: true,
      showInput: true,
      showRawInput: true,
      showEffects: true,
      showBalanceChanges: true,
    }
  });

  prettyPrintTransactionResult(res);
}

main().catch(console.error);
