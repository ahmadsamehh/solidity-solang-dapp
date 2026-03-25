import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

type SigningContext = {
  signTransaction: SignTransaction;
  publicKey: string;
};

function getDevSigner(): SigningContext | null {
  const secret = import.meta.env.VITE_STELLAR_SECRET_KEY;
  if (!secret) return null;

  const keypair = Keypair.fromSecret(secret);

  const signTransaction: SignTransaction = async (xdr, opts) => {
    const networkPassphrase =
      opts?.networkPassphrase || Networks.TESTNET;
    const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
    tx.sign(keypair);
    return { signedTxXdr: tx.toXDR() };
  };

  return { signTransaction, publicKey: keypair.publicKey() };
}

async function getFreighterSigner(): Promise<SigningContext | null> {
  const freighter = (globalThis as any)?.freighterApi;
  if (freighter?.signTransaction && freighter?.getPublicKey) {
    const publicKey = await freighter.getPublicKey();
    const signTransaction: SignTransaction = freighter.signTransaction.bind(
      freighter
    );
    return { signTransaction, publicKey };
  }
  return null;
}

export async function resolveSigningContext(): Promise<SigningContext | null> {
  return getDevSigner() ?? (await getFreighterSigner());
}
