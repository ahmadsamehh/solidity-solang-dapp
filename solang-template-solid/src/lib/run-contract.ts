export async function runContractMethod(
  client: any,
  methodName: string,
  args: Record<string, any>
) {
  const method = client?.[methodName];

  if (typeof method !== "function") {
    throw new Error(`Method "${methodName}" was not found in the generated contract client.`);
  }

  const response = await method(args);

  if (response && typeof response === "object" && "result" in response) {
    return response.result;
  }

  return response;
}
