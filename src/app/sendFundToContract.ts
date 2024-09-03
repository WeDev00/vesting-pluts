import {
  Address,
  Credential,
  CredentialType,
  harden,
  pBSToData,
  pByteString,
  pIntToData,
  PrivateKey,
  Script,
  ScriptType,
  Value,
  XPrv,
} from "@harmoniclabs/plu-ts";
import { script } from "../contract";
import { readFile } from "fs/promises";
import { mnemonicToEntropy } from "bip39";
import blockfrost from "./blockfrost";
import getTxBuilder from "./getTxBuilder";
import VestingDatum from "../VestingDatum";

async function createVesting() {
  const scriptFile = await readFile("./testnet/vesting.plutus.json", {
    encoding: "utf-8",
  });
  const script = Script.fromCbor(
    JSON.parse(scriptFile).cborHex,
    ScriptType.PlutusV3
  );
  const scriptAddr = new Address(
    "testnet",
    new Credential(CredentialType.Script, script.hash)
  );
  const xprv = XPrv.fromEntropy(mnemonicToEntropy(process.env.SEED_PHRASE!));
  // payment key at path "m/1852'/1815'/0'/0/0"
  const privateKey = xprv
    .derive(harden(1852))
    .derive(harden(1815))
    .derive(harden(0))
    .derive(0)
    .derive(0);

  // get the default address of the private key
  const address = Address.fromXPrv(xprv, "testnet");
  const Blockfrost = blockfrost();
  const utxos = await Blockfrost.addressUtxos(address);
  const utxo = utxos.find((utxo) => utxo.resolved.value.lovelaces >= 5000000)!;
  const txBuilder = await getTxBuilder(Blockfrost);
  const nowPosix = Math.floor(Date.now() / 1000);
  let tx = txBuilder.buildSync({
    inputs: [{ utxo: utxo }],
    collaterals: [utxo],
    outputs: [
      {
        address: scriptAddr,
        value: Value.lovelaces(5000000),
        datum: VestingDatum.VestingDatum({
          beneficiary: pBSToData.$(
            pByteString(address.paymentCreds.hash.toBuffer())
          ),
          deadline: pIntToData.$(nowPosix + 10_000),
        }),
      },
    ],
    changeAddress: address,
  });

  tx.signWith(privateKey);

  const submittedTx = await Blockfrost.submitTx(tx);
  console.log("tx submitted: ", submittedTx);
}
createVesting();
