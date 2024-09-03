import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import dotenv from "dotenv";
dotenv.config();

function blockfrost() {
  const provider = new BlockfrostPluts({
    projectId: process.env.BLOCKFROST_API_KEY as string,
  });
  return provider;
}

export default blockfrost;
