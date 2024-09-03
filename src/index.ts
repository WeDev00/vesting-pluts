import { script } from "./contract";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";

console.log("validator compiled succesfully! 🎉\n");
console.log(JSON.stringify(script.toJson(), undefined, 2));

async function main() {
  //salvare il contratto compilato in un file json
  if (!existsSync("./testnet")) {
    await mkdir("./testnet");
  }
  await writeFile(
    "./testnet/vesting.plutus.json",
    JSON.stringify(script.toJson(), undefined, 4)
  );

  //------------------------------------------------//
}
main();
