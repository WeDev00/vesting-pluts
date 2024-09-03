import { int, PPubKeyHash, pstruct } from "@harmoniclabs/plu-ts";

const VestingDatum = pstruct({
  VestingDatum: {
    beneficiary: PPubKeyHash.type,
    deadline: int, // posix time
  },
});

export default VestingDatum;
