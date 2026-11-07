const crypto=require('node:crypto');
const SOURCE_SHA='91b1b39e4ffb81ed3a8b306fdd549518f2023489e2f05aa75f35e26decb76c38';
const FUNCTION_SHA='10f1816a2a838be52458dbceb61a6d48e8681071965f89263b8af22ffa9e9674';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function buildControlRowCandidate(bytes){
 if(hash(bytes)!==SOURCE_SHA)throw Error('UNSUPPORTED_CONVERSATION_SOURCE');
 const source=bytes.toString('utf8'),marker='function observeControlRow(row) {';
 if(source.split(marker).length!==2)throw Error('CONTROL_ROW_FUNCTION_NOT_UNIQUE');
 const start=source.indexOf(marker),regionEnd=source.indexOf('\t\t//#endregion',start);
 if(regionEnd<0)throw Error('CONTROL_ROW_BOUNDARY');
 const original=source.slice(start,regionEnd).replace(/[\r\n]+$/,'');
 if(hash(original)!==FUNCTION_SHA)throw Error('CONTROL_ROW_FUNCTION_PIN');
 const eol=source.includes('\r\n')?'\r\n':'\n',normalized=original.replaceAll('\r\n','\n');
 const after=normalized.replace('const resize = new ResizeObserver(measure);',`let pendingFrame = null;
\t\t\tlet disposed = false;
\t\t\tconst resize = new ResizeObserver(() => {
\t\t\t\tif (disposed || pendingFrame !== null) return;
\t\t\t\tpendingFrame = requestAnimationFrame(() => {
\t\t\t\t\tpendingFrame = null;
\t\t\t\t\tif (!disposed && row.isConnected) measure();
\t\t\t\t});
\t\t\t});`).replace('resize.disconnect();',`disposed = true;
\t\t\t\tif (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
\t\t\t\tpendingFrame = null;
\t\t\t\tresize.disconnect();`).replaceAll('\n',eol);
 if(after===original||after.split('pendingFrame = requestAnimationFrame').length!==2)throw Error('CONTROL_ROW_PATCH_BOUNDARY');
 return {bytes:Buffer.from(source.slice(0,start)+after+source.slice(start+original.length)),originalFunction:original,candidateFunction:after};
}
module.exports={SOURCE_SHA,FUNCTION_SHA,buildControlRowCandidate};
