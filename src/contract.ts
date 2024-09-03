import {
  Address,
  compile,
  Credential,
  pfn,
  Script,
  ScriptType,
  PScriptContext,
  pBool,
  bool,
  data,
  pmatch,
  ptraceIfFalse,
  pdelay,
  pStr,
  plet,
  PMaybe,
  perror,
  unit,
  passert,
  punsafeConvertType,
} from "@harmoniclabs/plu-ts";
import VestingDatum from "./VestingDatum";

//questo contratto valida lo spending di un UTXO solo se il beneficiario (definito nel datum che gli passiamo) ha firmato la transazione e la deadline non è stata raggiunta

export const contract = pfn(
  [PScriptContext.type],
  unit
)(({ redeemer, tx, purpose }) => {
  //N.B. non c'è destrutturizzazione, i parametri sono assegnati uno per uno
  const datum = plet(
    pmatch(purpose)
      .onSpending(({ datum: maybeDatum }) =>
        punsafeConvertType(maybeDatum.unwrap, VestingDatum.type)
      )
      ._((_) => perror(VestingDatum.type))
  );

  //inlined = stiamo trattenendo nella "variabile" signedByBeneficiary il riferimento al pezzo di codice che segue dopo l'uguale, NON stiamo creando una variabile usando plet
  const signedByBeneficiary = tx.signatories.some((signer) =>
    signer.eq(datum.beneficiary)
  );

  const deadlineReached = pmatch(tx.interval.from.bound)
    .onPFinite(({ n: lowerInterval }) => datum.deadline.ltEq(lowerInterval))
    ._((_) => pBool(false));

  //usare pAsser per ritornare una unit a partire da un booleano
  return passert.$(
    signedByBeneficiary.and(
      ptraceIfFalse
        .$(pdelay(pStr("deadline not reached or not specified")))
        .$(deadlineReached)
    )
  );
});

///////////////////////////////////////////////////////////////////
// ------------------------------------------------------------- //
// ------------------------- utilities ------------------------- //
// ------------------------------------------------------------- //
///////////////////////////////////////////////////////////////////

export const compiledContract = compile(contract);

export const script = new Script(ScriptType.PlutusV3, compiledContract);

export const scriptMainnetAddr = new Address(
  "mainnet",
  Credential.script(script.hash)
);

export const scriptTestnetAddr = new Address(
  "testnet",
  Credential.script(script.hash.clone())
);

export default contract;
