import type { Component } from "solid-js";
import { createSignal, For } from "solid-js";
import contractClient from "./contracts/current";
import schema from "./generated/contract-schema.json";
import { parseValueByType } from "./lib/parse-value";
import { runContractMethod } from "./lib/run-contract";

type ContractInput = {
  name: string;
  type: string;
  rawType?: string;
  label?: string;
  placeholder?: string;
};

type ContractMethod = {
  name: string;
  label: string;
  description?: string;
  inputs: ContractInput[];
  output?: {
    type: string;
    rawType?: string;
  };
};

type ContractSchema = {
  contract: string;
  generatedAt?: string;
  methods: ContractMethod[];
};

const contractSchema = schema as ContractSchema;

const App: Component = () => {
  const [formValues, setFormValues] = createSignal<Record<string, string>>({});
  const [result, setResult] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [loadingMethod, setLoadingMethod] = createSignal<string | null>(null);

  function fieldKey(methodName: string, fieldName: string) {
    return `${methodName}.${fieldName}`;
  }

  function getFieldValue(methodName: string, fieldName: string) {
    return formValues()[fieldKey(methodName, fieldName)] || "";
  }

  function setFieldValue(methodName: string, fieldName: string, value: string) {
    setFormValues((prev) => ({
      ...prev,
      [fieldKey(methodName, fieldName)]: value,
    }));
  }

  async function executeMethod(method: ContractMethod) {
    setError(null);
    setResult("");
    setLoadingMethod(method.name);

    try {
      const args: Record<string, any> = {};

      for (const input of method.inputs) {
        args[input.name] = parseValueByType(
          input.type,
          getFieldValue(method.name, input.name)
        );
      }

      const value = await runContractMethod(contractClient, method.name, args);
      setResult(`${method.name}: ${String(value)}`);
    } catch (err: any) {
      console.error(`${method.name} error:`, err);
      setError(err?.message || String(err) || "Unknown contract error");
    } finally {
      setLoadingMethod(null);
    }
  }

  return (
    <div
      style={{
        margin: "0",
        "min-height": "100vh",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        background:
          "linear-gradient(135deg, #0f172a 0%, #111827 50%, #1e293b 100%)",
        padding: "24px",
        color: "#e5e7eb",
        "font-family":
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          "max-width": "960px",
          background: "rgba(15, 23, 42, 0.88)",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          "border-radius": "20px",
          padding: "28px",
          "box-shadow": "0 20px 60px rgba(0,0,0,0.35)",
          "backdrop-filter": "blur(10px)",
        }}
      >
        <div style={{ "margin-bottom": "24px" }}>
          <p
            style={{
              margin: "0 0 8px 0",
              "font-size": "13px",
              color: "#93c5fd",
              "letter-spacing": "0.08em",
              "text-transform": "uppercase",
              "font-weight": "700",
            }}
          >
            Auto Generated Contract UI
          </p>

          <h1
            style={{
              margin: "0 0 8px 0",
              "font-size": "32px",
              "line-height": "1.1",
              "font-weight": "800",
              color: "#f8fafc",
            }}
          >
            {contractSchema.contract} Contract Runner
          </h1>

          <p
            style={{
              margin: 0,
              color: "#94a3b8",
              "font-size": "15px",
              "line-height": "1.6",
            }}
          >
            This interface is generated automatically from the deployed contract
            methods.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: "18px",
            "grid-template-columns": "repeat(auto-fit, minmax(320px, 1fr))",
            "margin-bottom": "24px",
          }}
        >
          <For each={contractSchema.methods}>
            {(method) => (
              <div
                style={{
                  padding: "20px",
                  "border-radius": "16px",
                  background: "rgba(30, 41, 59, 0.6)",
                  border: "1px solid rgba(148, 163, 184, 0.16)",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 6px 0",
                    "font-size": "20px",
                    "font-weight": "800",
                    color: "#f8fafc",
                  }}
                >
                  {method.label}
                </h2>

                <p
                  style={{
                    margin: "0 0 8px 0",
                    color: "#94a3b8",
                    "font-size": "14px",
                    "line-height": "1.5",
                  }}
                >
                  {method.description || `Run ${method.name}`}
                </p>

                <p
                  style={{
                    margin: "0 0 16px 0",
                    color: "#64748b",
                    "font-size": "12px",
                  }}
                >
                  Returns: {method.output?.rawType || method.output?.type || "unknown"}
                </p>

                <div style={{ display: "grid", gap: "12px" }}>
                  <For each={method.inputs}>
                    {(input) => (
                      <div>
                        <label
                          style={{
                            display: "block",
                            "margin-bottom": "8px",
                            "font-size": "14px",
                            "font-weight": "600",
                            color: "#cbd5e1",
                          }}
                        >
                          {input.label || input.name}
                        </label>

                        <input
                          type="text"
                          placeholder={
                            input.placeholder ||
                            `${input.name} (${input.rawType || input.type})`
                          }
                          value={getFieldValue(method.name, input.name)}
                          onInput={(e) =>
                            setFieldValue(
                              method.name,
                              input.name,
                              e.currentTarget.value
                            )
                          }
                          style={{
                            width: "100%",
                            padding: "14px 16px",
                            "border-radius": "12px",
                            border: "1px solid #334155",
                            background: "#0f172a",
                            color: "#f8fafc",
                            "font-size": "15px",
                            outline: "none",
                            "box-sizing": "border-box",
                          }}
                        />
                      </div>
                    )}
                  </For>

                  <button
                    type="button"
                    onClick={() => executeMethod(method)}
                    disabled={loadingMethod() === method.name}
                    style={{
                      padding: "14px 16px",
                      border: "none",
                      "border-radius": "12px",
                      background:
                        loadingMethod() === method.name
                          ? "#475569"
                          : "linear-gradient(135deg, #2563eb, #3b82f6)",
                      color: "white",
                      "font-size": "15px",
                      "font-weight": "700",
                      cursor:
                        loadingMethod() === method.name ? "not-allowed" : "pointer",
                      "box-shadow": "0 10px 25px rgba(37, 99, 235, 0.28)",
                    }}
                  >
                    {loadingMethod() === method.name ? "Processing..." : `Run ${method.name}`}
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>

        {error() && (
          <div
            style={{
              "margin-bottom": "16px",
              padding: "12px 14px",
              "border-radius": "12px",
              background: "rgba(127, 29, 29, 0.35)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              color: "#fecaca",
              "font-size": "14px",
            }}
          >
            {error()}
          </div>
        )}

        <div
          style={{
            padding: "18px",
            "border-radius": "16px",
            background: "rgba(30, 41, 59, 0.6)",
            border: "1px solid rgba(148, 163, 184, 0.16)",
          }}
        >
          <p
            style={{
              margin: "0 0 8px 0",
              color: "#94a3b8",
              "font-size": "13px",
              "text-transform": "uppercase",
              "letter-spacing": "0.06em",
              "font-weight": "700",
            }}
          >
            Result
          </p>

          <p
            style={{
              margin: 0,
              "font-size": "28px",
              "font-weight": "800",
              color: "#f8fafc",
              "word-break": "break-word",
            }}
          >
            {result() || "—"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
