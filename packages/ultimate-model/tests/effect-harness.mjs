// Synchronous subset of Cordis 4.0.5 _execute: consume all iterator values now.
// This is a unit fixture, not a substitute for the real SDK integration.
export function runEffect(factory) {
 const removers=[];let disposed=false
 const dispose=()=>{if(disposed)return;disposed=true;for(const remove of removers.toReversed())remove()}
 const collect=value=>{if(value==null)return;if(typeof value!=='function')throw new TypeError('Invalid effect');removers.push(value)}
 try {
  const result=factory()
  if(typeof result==='function'||result==null)collect(result)
  else if(result[Symbol.iterator]){const iterator=result[Symbol.iterator]();while(true){const step=iterator.next();collect(step.value);if(step.done)break}}
  else throw new TypeError('Synchronous effect fixture does not support this result')
 }catch(error){dispose();throw error}
 return dispose
}
