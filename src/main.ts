import * as aokvw from "./aokvw";
import * as aokvr from "./aokvr";

export type AOKVW = aokvw.AOKVW;
export const AOKVW = aokvw.AOKVW;
export const zlibRawCompress = aokvw.zlibRawCompress;

export type AOKVR = aokvr.AOKVR;
export const AOKVR = aokvr.AOKVR;
export const blobToPread = aokvr.blobToPread;
export const zlibRawDecompress = aokvr.zlibRawDecompress;
