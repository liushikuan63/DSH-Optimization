const crypto=require('node:crypto');
const BEFORE='3b82b41e3e94566e43105a2552c0a4804983be39e1e16ad8b0d0646c76ec0057';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const oldBlock=`\t\tif (!callerCancelled(signal)) console.error("[deepseek-account] request failed", {
\t\t\tpath,
\t\t\tstatus: response.status,
\t\t\terrorCode: "network"
\t\t});`;
const newBlock=`\t\tif (!callerCancelled(signal)) {
\t\t\tif (response.status === 403) {
\t\t\t\t// A forbidden HTTP response is not a transport outage or proof of an expired grant.
\t\t\t\t// Keep the legacy error category while exposing only fixed metadata in one log string.
\t\t\t\tconst contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
\t\t\t\tconsole.error("[deepseek-account] request failed " + JSON.stringify({
\t\t\t\t\tpath: ["/auth-api/v0/users/current", "/api/v0/users/get_user_summary"].includes(path) ? path : "OTHER_ENDPOINT",
\t\t\t\t\tstatus: 403,
\t\t\t\t\terrorCode: "network",
\t\t\t\t\thttpCategory: "forbidden",
\t\t\t\t\tresponseKind: contentType === "text/html" ? "html" : contentType === "application/json" || contentType.endsWith("+json") ? "json" : "other",
\t\t\t\t\tedge: response.headers.has("x-amz-cf-id") ? "cloudfront" : response.headers.has("cf-ray") ? "cloudflare" : "unknown",
\t\t\t\t\taction: "CHECK_PLATFORM_NETWORK_OR_ACCESS_POLICY"
\t\t\t\t}));
\t\t\t} else console.error("[deepseek-account] request failed", {
\t\t\t\tpath,
\t\t\t\tstatus: response.status,
\t\t\t\terrorCode: "network"
\t\t\t});
\t\t}`;
function buildCandidate(bytes){
 if(sha(bytes)!==BEFORE)throw Error('UNSUPPORTED_ACCOUNT_SOURCE');
 const text=bytes.toString('utf8'),eol=text.includes('\r\n')?'\r\n':'\n';const source=text.replaceAll('\r\n','\n');
 if(source.split(oldBlock).length!==2)throw Error('ACCOUNT_NON_OK_BLOCK_NOT_UNIQUE');
 return Buffer.from(source.replace(oldBlock,newBlock).replaceAll('\n',eol));
}
module.exports={BEFORE,buildCandidate};
