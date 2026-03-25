import "dotenv/config";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
} from "fs";
import { execSync, exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { sync as glob } from "glob";
import { promisify } from "util";
import {
  rpc as SorobanRpc,
  Keypair,
  StrKey,
  Address,
  scValToNative,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Networks,
} from "@stellar/stellar-sdk";

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

const contractRoot = path.resolve(
  dirname,
  process.env.PUBLIC_STELLAR_CONTRACT_PATH
);

const solangSource = path.resolve(
  contractRoot,
  process.env.PUBLIC_SOLANG_SOURCE || "contract.sol"
);

const solangOutDir = path.resolve(
  contractRoot,
  process.env.PUBLIC_SOLANG_OUTDIR || "build"
);

const solangCompileCommand =
  process.env.PUBLIC_SOLANG_COMPILE_COMMAND ||
  `solang compile --target soroban --output "${
    process.env.PUBLIC_SOLANG_OUTDIR || "build"
  }" "${process.env.PUBLIC_SOLANG_SOURCE || "contract.sol"}"`;

const packagesRoot = path.join(dirname, "packages");
const contractsOutputDir = path.join(dirname, "src/contracts");
const generatedOutputDir = path.join(dirname, "src/generated");
const packageJsonPath = path.join(dirname, "package.json");

let smartContracts = [];

const execAsync = promisify(exec);
const rpcServer = new SorobanRpc.Server(process.env.PUBLIC_STELLAR_RPC_URL, {
  allowHttp:
    process.env.PUBLIC_STELLAR_NETWORK === "local" ||
    process.env.PUBLIC_STELLAR_NETWORK === "standalone",
});

const networkPassphrase =
  process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

function resolveKeypair() {
  const secret =
    process.env.STELLAR_SECRET_KEY || process.env.PUBLIC_STELLAR_SECRET_KEY;

  if (!secret) {
    throw new Error(
      "STELLAR_SECRET_KEY is required to sign Soroban transactions. Add it to .env."
    );
  }

  return Keypair.fromSecret(secret);
}

function resolvePublicKey(keypair) {
  const configured = process.env.PUBLIC_STELLAR_ACCOUNT;

  if (configured && StrKey.isValidEd25519PublicKey(configured)) {
    if (configured !== keypair.publicKey()) {
      throw new Error(
        "PUBLIC_STELLAR_ACCOUNT does not match STELLAR_SECRET_KEY. Update PUBLIC_STELLAR_ACCOUNT to the secret's public key."
      );
    }
    return configured;
  }

  return keypair.publicKey();
}

async function ensureAccountExists(publicKey) {
  try {
    await rpcServer.getAccount(publicKey);
    console.log(`Using existing Stellar account ${publicKey}.`);
    return;
  } catch (err) {
    if (process.env.PUBLIC_STELLAR_NETWORK === "testnet") {
      console.log(`Funding testnet account ${publicKey} via friendbot...`);
      await rpcServer.fundAddress(publicKey);
      return;
    }

    throw new Error(
      `Account ${publicKey} not found. Fund it or switch to testnet for friendbot.`
    );
  }
}

async function submitTransaction(tx, label) {
  const preparedTx = await rpcServer.prepareTransaction(tx);
  preparedTx.sign(activeKeypair);

  const sendResponse = await rpcServer.sendTransaction(preparedTx);

  if (sendResponse.status === "ERROR") {
    throw new Error(
      `${label} transaction failed to submit. Check diagnostics on the RPC server.`
    );
  }

  const txResult = await rpcServer.pollTransaction(sendResponse.hash, {
    attempts: 60,
  });

  if (txResult.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(
      `${label} transaction failed with status ${txResult.status}.`
    );
  }

  return txResult;
}

const activeKeypair = resolveKeypair();
const activePublicKey = resolvePublicKey(activeKeypair);

// ###################### Helpers ########################

function filenameNoExtension(filename) {
  return path.basename(filename, path.extname(filename));
}

function removeFiles(pattern) {
  glob(pattern).forEach((entry) => rmSync(entry, { force: true }));
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function syncLocalPackageDependencies(aliases) {
  if (!existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${packageJsonPath}`);
  }

  const pkg = readJson(packageJsonPath);
  const dependencies = { ...(pkg.dependencies || {}) };

  for (const [depName, depValue] of Object.entries(dependencies)) {
    if (
      typeof depValue === "string" &&
      (depValue.startsWith("file:packages/") ||
        depValue.startsWith("file:./packages/"))
    ) {
      delete dependencies[depName];
    }
  }

  for (const alias of aliases) {
    dependencies[alias] = `file:packages/${alias}`;
  }

  pkg.dependencies = Object.fromEntries(
    Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b))
  );

  writeJson(packageJsonPath, pkg);

  console.log(
    `Updated package.json local contract dependencies: ${
      aliases.length ? aliases.join(", ") : "(none)"
    }`
  );

  execSync("pnpm install", {
    cwd: dirname,
    stdio: "inherit",
  });
}

// ###################### Create User ########################

async function createUser() {
  await ensureAccountExists(activePublicKey);
}

// ###################### Build Contracts ########################

function ensureSolangInputs() {
  console.log("dirname =", dirname);
  console.log(
    "PUBLIC_STELLAR_CONTRACT_PATH =",
    process.env.PUBLIC_STELLAR_CONTRACT_PATH
  );
  console.log("contractRoot =", contractRoot);
  console.log("solangSource =", solangSource);
  console.log("solangOutDir =", solangOutDir);

  if (!existsSync(contractRoot)) {
    throw new Error(`Contract folder not found: ${contractRoot}`);
  }

  if (!existsSync(solangSource)) {
    throw new Error(`Solidity source file not found: ${solangSource}`);
  }

  ensureDir(solangOutDir);
}

function buildAll() {
  ensureSolangInputs();

  removeFiles(`${solangOutDir}/*.wasm`);
  removeFiles(`${solangOutDir}/*.abi`);
  removeFiles(`${solangOutDir}/*.contract`);
  removeFiles(`${solangOutDir}/*.json`);

  console.log("Compiling Solidity contract with Solang...");
  console.log(`Working directory: ${contractRoot}`);
  console.log(`Compile command: ${solangCompileCommand}`);

  execSync(solangCompileCommand, {
    stdio: "inherit",
    cwd: contractRoot,
  });

  console.log("Solang build complete");
}

// ###################### Deploy Contracts ########################

async function deploy(wasm) {
  const alias = filenameNoExtension(wasm);
  const wasmBuffer = readFileSync(wasm);

  const uploadAccount = await rpcServer.getAccount(activePublicKey);
  const uploadTx = new TransactionBuilder(uploadAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBuffer }))
    .setTimeout(0)
    .build();

  const uploadResult = await submitTransaction(uploadTx, `upload ${alias}`);
  const uploadedHash = uploadResult.returnValue
    ? scValToNative(uploadResult.returnValue)
    : null;

  if (!uploadedHash) {
    throw new Error(`Upload did not return a wasm hash for ${alias}.`);
  }

  const wasmHash = Buffer.from(uploadedHash);

  const deployAccount = await rpcServer.getAccount(activePublicKey);
  const createTx = new TransactionBuilder(deployAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.createCustomContract({
        address: new Address(activePublicKey),
        wasmHash,
      })
    )
    .setTimeout(0)
    .build();

  const createResult = await submitTransaction(createTx, `deploy ${alias}`);
  const contractId = createResult.returnValue
    ? scValToNative(createResult.returnValue)
    : null;

  if (typeof contractId !== "string") {
    throw new Error(`Deploy did not return a contract ID for ${alias}.`);
  }

  smartContracts.push({
    alias,
    wasm,
    contractid: contractId,
  });

  console.log(`Deployed ${alias} -> ${contractId}`);
}

async function deployAll() {
  console.log("Deploying all contracts");

  const wasmFiles = glob(`${solangOutDir}/*.wasm`);

  if (wasmFiles.length === 0) {
    throw new Error(`No wasm files found to deploy in ${solangOutDir}`);
  }

  for (const wasm of wasmFiles) {
    await deploy(wasm);
  }
}

// ###################### Create Bindings ########################

function bind({ alias, contractid }) {
  ensureDir(packagesRoot);

  const packageDir = path.join(packagesRoot, alias);

  console.log(`Generating TypeScript bindings for ${alias}...`);

  execSync(
    `stellar contract bindings typescript --contract-id ${contractid} --output-dir "${packageDir}" --overwrite`,
    { stdio: "inherit" }
  );

  if (!existsSync(packageDir)) {
    throw new Error(
      `‼️ Generated package folder was not created for ${alias}: ${packageDir}`
    );
  }

  execSync("npm install", {
    cwd: packageDir,
    stdio: "inherit",
  });

  execSync("npm run build", {
    cwd: packageDir,
    stdio: "inherit",
  });

  console.log(`Bindings built for ${alias}`);
}

async function bindAll() {
  for (const contract of smartContracts) {
    bind(contract);
  }

  syncLocalPackageDependencies(smartContracts.map((c) => c.alias));
}

// ###################### Import Bindings ########################

function importContract({ alias, contractid }) {
  ensureDir(contractsOutputDir);

  const allowHttp =
    process.env.PUBLIC_STELLAR_NETWORK === "local" ||
    process.env.PUBLIC_STELLAR_NETWORK === "standalone";

  const importContent =
    `import * as Client from "${alias}";\n` +
    `export default new Client.Client({\n` +
    `  contractId: "${contractid}",\n` +
    `  networkPassphrase: "${process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE}",\n` +
    `  rpcUrl: "${process.env.PUBLIC_STELLAR_RPC_URL}",\n` +
    (allowHttp ? `  allowHttp: true,\n` : "") +
    `});\n`;

  const outputPath = path.join(contractsOutputDir, `${alias}.ts`);
  writeFileSync(outputPath, importContent);

  const currentContractPath = path.join(contractsOutputDir, "current.ts");
  const currentContractContent = `export { default } from "./${alias}";\n`;

  writeFileSync(currentContractPath, currentContractContent);

  console.log(`Created import for ${alias}`);
  console.log(`Updated current contract alias -> ${alias}`);
}

function importAll() {
  smartContracts.forEach(importContract);
}

// ###################### Generate Dynamic Schema ########################

function detectSimpleType(typeText) {
  const lower = String(typeText).toLowerCase();

  if (lower.includes("u64") || lower.includes("uint64")) return "u64";
  if (lower.includes("i64") || lower.includes("int64")) return "i64";
  if (lower.includes("bool")) return "bool";
  if (lower.includes("string") || lower.includes("str")) return "string";
  if (lower.includes("address")) return "address";

  return "unknown";
}

function cleanType(typeText) {
  return String(typeText).trim().replace(/\s+/g, " ");
}

function shouldSkipMethod(methodName) {
  return (
    methodName === "constructor" ||
    methodName === "__constructor" ||
    methodName.startsWith("__")
  );
}

function parseContractInterfaceText(interfaceText, alias) {
  const lines = interfaceText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const methods = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/;$/, "");

    if (!line.includes("(") || !line.includes(")")) continue;

    const match = line.match(
      /^(?:pub\s+)?(?:fn\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)(?:\s*->\s*(.*))?$/
    );

    if (!match) continue;

    const methodName = match[1];

    if (shouldSkipMethod(methodName)) continue;

    const rawParams = match[2]?.trim() || "";
    const rawOutput = match[3]?.trim() || "void";

    const inputs = [];

    if (rawParams.length > 0) {
      const parts = rawParams
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      for (const part of parts) {
        const paramMatch = part.match(
          /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/
        );

        if (!paramMatch) {
          inputs.push({
            name: `arg${inputs.length + 1}`,
            type: "unknown",
            rawType: cleanType(part),
            label: `Argument ${inputs.length + 1}`,
            placeholder: `Enter argument ${inputs.length + 1}`,
          });
          continue;
        }

        const inputName = paramMatch[1];
        const rawType = cleanType(paramMatch[2]);

        if (
          inputName === "env" ||
          rawType === "Env" ||
          rawType.endsWith("::Env")
        ) {
          continue;
        }

        inputs.push({
          name: inputName,
          type: detectSimpleType(rawType),
          rawType,
          label: inputName,
          placeholder: `Enter ${inputName}`,
        });
      }
    }

    methods.push({
      name: methodName,
      label: methodName,
      description: `Auto-generated form for ${methodName}`,
      inputs,
      output: {
        type: detectSimpleType(rawOutput),
        rawType: cleanType(rawOutput),
      },
    });
  }

  return {
    contract: alias,
    generatedAt: new Date().toISOString(),
    methods,
  };
}

async function generateSchema(contract) {
  ensureDir(generatedOutputDir);

  const command = `stellar contract info interface --wasm "${contract.wasm}"`;

  const { stdout, stderr } = await execAsync(command, {
    cwd: contractRoot,
  });

  const interfaceText = `${stdout || ""}\n${stderr || ""}`.trim();

  console.log("RAW INTERFACE OUTPUT:\n", interfaceText);

  if (!interfaceText) {
    throw new Error("No interface output was returned from stellar CLI.");
  }

  const parsedSchema = parseContractInterfaceText(interfaceText, contract.alias);

  if (!parsedSchema.methods.length) {
    throw new Error(
      `Schema generation parsed 0 methods. Raw interface output was:\n${interfaceText}`
    );
  }

  const outputPath = path.join(generatedOutputDir, "contract-schema.json");
  writeFileSync(outputPath, JSON.stringify(parsedSchema, null, 2));

  console.log(`Generated schema for ${contract.alias}`);
}

async function generateSchemaAll() {
  if (smartContracts.length === 0) {
    throw new Error("No deployed contracts available for schema generation.");
  }

  await generateSchema(smartContracts[0]);
}

// ###################### Main ########################

async function main() {
  await createUser();
  buildAll();
  await deployAll();
  await bindAll();
  importAll();
  await generateSchemaAll();
}

main().catch((e) => {
  console.error("Initialization failed", e);
  process.exit(1);
});
