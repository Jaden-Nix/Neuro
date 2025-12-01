import * as fs from "fs";
import * as path from "path";
import solc from "solc";

function findImports(importPath: string) {
  const nodeModulesPath = path.join(process.cwd(), "node_modules", importPath);
  const contractsPath = path.join(process.cwd(), "contracts", importPath);
  
  try {
    if (fs.existsSync(nodeModulesPath)) {
      return { contents: fs.readFileSync(nodeModulesPath, "utf8") };
    }
    if (fs.existsSync(contractsPath)) {
      return { contents: fs.readFileSync(contractsPath, "utf8") };
    }
    return { error: `File not found: ${importPath}` };
  } catch (error) {
    return { error: `Error reading file: ${importPath}` };
  }
}

async function compile() {
  console.log("Compiling contracts...\n");
  
  const contractsDir = path.join(process.cwd(), "contracts");
  const outputDir = path.join(process.cwd(), "artifacts");
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const contractFiles = fs.readdirSync(contractsDir).filter(f => f.endsWith(".sol"));
  
  const sources: Record<string, { content: string }> = {};
  for (const file of contractFiles) {
    const filePath = path.join(contractsDir, file);
    sources[file] = { content: fs.readFileSync(filePath, "utf8") };
  }
  
  const input = {
    language: "Solidity",
    sources,
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };
  
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports })
  );
  
  if (output.errors) {
    const hasErrors = output.errors.some((e: any) => e.severity === "error");
    for (const error of output.errors) {
      if (error.severity === "error") {
        console.error(`ERROR: ${error.formattedMessage}`);
      } else {
        console.warn(`WARNING: ${error.formattedMessage}`);
      }
    }
    if (hasErrors) {
      process.exit(1);
    }
  }
  
  const compiledContracts: Record<string, any> = {};
  
  for (const [sourceName, contracts] of Object.entries(output.contracts || {})) {
    for (const [contractName, contract] of Object.entries(contracts as Record<string, any>)) {
      const artifact = {
        contractName,
        sourceName,
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
      };
      
      const artifactPath = path.join(outputDir, `${contractName}.json`);
      fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
      
      compiledContracts[contractName] = artifact;
      console.log(`Compiled: ${contractName} -> ${artifactPath}`);
    }
  }
  
  console.log(`\nCompiled ${Object.keys(compiledContracts).length} contracts successfully!`);
  return compiledContracts;
}

compile().catch(console.error);
