import * as dfd from "danfojs";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

export async function GET(request) {
  const fileDir = path.resolve(process.cwd(), "data");

  console.log({ fileDir });

  const files = fs
    .readdirSync(fileDir)
    .filter((file) => file.endsWith(".xlsx"));

  console.log({ files });
  let combinedData = [];

  for (const file of files) {
    const filePath = path.join(fileDir, file);

    console.log(`Checking file path: ${filePath}`);

    // Properly check file readability
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      console.log(`File is readable: ${filePath}`);
    } catch (err) {
      console.error(`File is not readable: ${filePath}`, err.message);
      continue; // Skip to the next file if not readable
    }

    try {
      //   const workbook = XLSX.readFile(filePath);
      // Read file as a binary buffer
      const fileBuffer = fs.readFileSync(filePath);
      console.log(`File buffer read successfully: ${filePath}`);

      // Use XLSX to read the buffer
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });

      //   console.log({ workbook });

      // Assume the first sheet is the one we want
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      //   console.log({ sheetName });

      //   console.log({ worksheet });

      // Convert Excel sheet to JSON format
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      //   console.log({ jsonData });

      combinedData = combinedData.concat(jsonData); // Combine data
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error.message);
      continue;
    }
  }

  if (combinedData.length === 0) {
    return Response.json(
      { message: "No data found", data: [] },
      { status: 404 }
    );
  }

  // Create a Danfo.js DataFrame from the combined JSON data
  const combinedDF = new dfd.DataFrame(combinedData);
  //   console.log(combinedDF.head(4).toString());

  combinedDF.ctypes.print();

  const finalDataframe = await preprocessData(combinedDF);

  //   return Response.json(
  //     { message: "ok", data: finalDataframe.toJSON() },
  //     { status: 200 }
  //   );
  return Response.json({ message: "ok" }, { status: 200 });
}

// Preprocess the data using Danfo.js
async function preprocessData(df) {
  // Drop unnecessary columns
  const dropColumns = ["Label", "ISRC", "UPC/EAN"];
  df.drop({ columns: dropColumns, axis: 1, inplace: true });

  // Filter data to focus on specific artists
  const artistsToFocusOn = [
    "HYPER VISOR",
    "ADRL",
    "ENVI",
    "rks.",
    "Bourbon",
    "Rush Besight",
    "Mia S.",
  ];
  df = df.loc({
    rows: df["Track Artist"].map((artist) => artistsToFocusOn.includes(artist)),
  });
  console.log(df.head(4).toString());

  const mostFrequentYear = (await df["Year"].mode()).values[0];

  //   // Correct usage of fillNa in Danfo.js
  df.fillNa({ columns: ["Year"], value: mostFrequentYear, inplace: true });

  //   df["Month"].print();

  //   // Ensure 'Month' is in the correct format (e.g., Jan, Feb, etc.)
  df["Month"] = df["Month"].str.slice(0, 2); // Assuming the format "01-Jan", this keeps only "Jan"

  // Combine 'Month' and 'Year' into a 'Date' column using DataFrame manipulation
  const dateStrings = df.apply(
    (row) => {
      const year = row["Year"];
      const month = row["Month"]; // Extract the numeric month part
      return `${year}-${month}-01`; // Creates a string like "2024-04-01"
    },
    { axis: 1 }
  ).values;

  return df;
}
