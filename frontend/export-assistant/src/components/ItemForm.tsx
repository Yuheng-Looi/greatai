import React, { useState } from "react";

interface Result {
  allowed: boolean;
  reason: string;
  checklist?: string[];
}

const ItemForm: React.FC = () => {
  const [item, setItem] = useState("");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // --- Temporary demo logic (replace later with API/AI) ---
    if (item.toLowerCase().includes("bicycle")) {
      setResult({
        allowed: true,
        reason:
          "According to Singapore Customs and MITI Malaysia, bicycles (HS Code 8712) are allowed for export/import.",
        checklist: [
          "Commercial Invoice",
          "Packing List",
          "Export Declaration (Malaysia)",
          "Import Permit (if required by Singapore Customs)",
          "Arrange shipping & courier"
        ],
      });
    } else {
      setResult({
        allowed: false,
        reason:
          `The item '${item}' is not recognized in the demo rule set. Please check HS Code classification.`,
      });
    }
  };

  return (
    <div className="form-container">
      <h2>Export Eligibility Checker</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Item Name:
          <input
            type="text"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            required
          />
        </label>

        <label>
          Item Details:
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. weight, material, usage"
          />
        </label>

        <button type="submit">Check</button>
      </form>

      {result && (
        <div className="result">
          <h3>Result</h3>
          <p><strong>Status:</strong> {result.allowed ? "✅ Allowed" : "❌ Not Allowed"}</p>
          <p><strong>Reason:</strong> {result.reason}</p>
          {result.allowed && result.checklist && (
            <>
              <h4>Checklist:</h4>
              <ul>
                {result.checklist.map((doc, idx) => (
                  <li key={idx}>{doc}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ItemForm;
