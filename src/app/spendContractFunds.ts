import {
  Address,
  DataI,
  Credential,
  PrivateKey,
  CredentialType,
  Script,
  DataConstr,
  DataB,
  PublicKey,
  defaultPreprodGenesisInfos,
  XPrv,
  harden,
  VKeyWitness,
  VKey,
  Signature,
  Data,
  ScriptType,
} from "@harmoniclabs/plu-ts";
import getTxBuilder from "./getTxBuilder";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import blockfrost from "./blockfrost";
import { readFile } from "fs/promises";
import { mnemonicToEntropy } from "bip39";

async function claimVesting() {
  const Blockfrost = blockfrost();
  const txBuilder = await getTxBuilder(Blockfrost);

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

  const utxos = await Blockfrost.addressUtxos(address).catch((e) => {
    throw new Error("unable to find utxos at " + address);
  });

  const utxo = utxos.find((utxo) => utxo.resolved.value.lovelaces >= 5000000);
  if (!utxo) {
    throw new Error("No utxo with more than 5 ada");
  }

  const scriptUtxos = await Blockfrost.addressUtxos(scriptAddr).catch((e) => {
    throw new Error("unable to find utxos at " + scriptAddr);
  });

  const scriptUtxo = scriptUtxos.find((utxo) => {
    console.log(
      "Utxo: " +
        JSON.stringify((utxo.resolved.datum! as Data).toJson(), undefined, 2)
    );

    if (utxo.resolved.datum instanceof DataConstr) {
      const pkhData = utxo.resolved.datum.fields[0];
      if (pkhData instanceof DataB) {
        return (
          address.paymentCreds.hash.toString() ==
          Buffer.from(pkhData.bytes.toBuffer()).toString("hex")
        );
      }
    }
    return false;
  });
  if (!scriptUtxo) {
    throw new Error("No script utxo found for the pkh");
  }

  const lastChainSlot = (await Blockfrost.getChainTip()).slot!;
  txBuilder.setGenesisInfos(defaultPreprodGenesisInfos);

  let tx = txBuilder.buildSync({
    inputs: [
      { utxo: utxo }, //incluso perchè verrà usato come collaterale e messo come input per coprire la fee di transazione
      {
        utxo: scriptUtxo,
        inputScript: {
          script: script,
          datum: "inline",
          redeemer: new DataI(0),
        },
      },
    ],
    requiredSigners: [address.paymentCreds.hash.toBuffer()], // required to be included in script context
    collaterals: [utxo],
    changeAddress: address,
    invalidBefore: lastChainSlot,
  });

  const { pubKey, signature } = privateKey.sign(tx.body.hash.toBuffer());
  tx.addVKeyWitness(
    new VKeyWitness(new VKey(pubKey), new Signature(signature))
  );
  //tx.signWith(privateKey);

  try {
    const submittedTx = await Blockfrost.submitTx(tx);
    console.log("tx submitted: ", submittedTx);
  } catch (e) {
    console.log("Error during transaction submit: " + e);
  }
}

claimVesting();
