import { resolveSigningContext } from "./sign-transaction";

export async function runContractMethod(
  client: any,
  methodName: string,
  args: Record<string, any>
) {
  const method = client?.[methodName];

  if (typeof method !== "function") {
    throw new Error(
      `Method "${methodName}" was not found in the generated contract client.`
    );
  }

  const signingContext = await resolveSigningContext();
  const hasArgs = args && Object.keys(args).length > 0;
  const options = signingContext
    ? {
        publicKey: signingContext.publicKey,
        signTransaction: signingContext.signTransaction,
      }
    : undefined;

  let response: any;

  try {
    response = hasArgs ? await method(args, options) : await method(options);
  } catch (err: any) {
    const message = err?.message || String(err);
    const missingPublicKey =
      message.includes("default account") || message.includes("publicKey");

    if (!missingPublicKey || signingContext) {
      throw err;
    }

    throw new Error(
      "This method needs a signing account. Connect Freighter or set VITE_STELLAR_SECRET_KEY."
    );
  }

  if (response && typeof response === "object") {
    if ("isReadCall" in response && response.isReadCall === false) {
      if (!signingContext) {
        throw new Error(
          "This method changes contract state. Connect Freighter or set VITE_STELLAR_SECRET_KEY to sign transactions."
        );
      }

      const sent = await response.signAndSend({
        signTransaction: signingContext.signTransaction,
      });
      return sent.result;
    }

    if ("result" in response) {
      return response.result;
    }
  }

  return response;
}
