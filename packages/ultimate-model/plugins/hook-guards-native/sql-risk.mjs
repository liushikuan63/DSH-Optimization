// Bounded SQL preflight, not a database permission boundary or a full SQL parser.
const SHELLS = new Set(['bash', 'pwsh', 'win_bash'])
const CLIENTS = new Set(['psql', 'mysql', 'mariadb', 'sqlcmd', 'sqlite3', 'duckdb', 'invoke-sqlcmd'])
function shellSegments(text) {
  const segments = []; let body = ''; let quote = ''
  for (let i=0;i<text.length;i++) {
    const c=text[i]
    if (quote) { body+=c; if(c==='\\' && quote!=="'") { body+=text[++i]||''; continue }; if(c===quote) quote=''; continue }
    if(c==='"'||c==="'"||c==='`') { quote=c; body+=c; continue }
    if(c===';'||c==='|'||c==='&'||c==='\n') { if(body.trim()) segments.push(body); body=''; continue }
    body+=c
  }
  if(body.trim()) segments.push(body)
  return segments
}
function shellWords(text) {
  const out=[]; let token=''; let quote=''
  for(let i=0;i<text.length;i++) {
    const c=text[i]
    if(quote) { if(c===quote) {quote='';continue}; if(c==='\\'&&quote==='"'&&['"','\\'].includes(text[i+1])) {token+=text[++i];continue}; token+=c;continue }
    if(c==='"'||c==="'") {quote=c;continue}
    if(/\s/.test(c)) {if(token){out.push(token);token=''};continue}
    token+=c
  }
  if(token)out.push(token)
  return out
}
export function sqlCandidates(name,args={}) {
  const found=[]
  if(typeof args.sql==='string') found.push(args.sql)
  if(typeof args.query==='string'&&/(?:sql|database|postgres|oracle|query|execute)/i.test(name)) found.push(args.query)
  if(!SHELLS.has(name)||typeof args.command!=='string')return found
  for(const segment of shellSegments(args.command)) {
    const words=shellWords(segment)
    while(words[0]&&/^[\w]+=[^\s]*$/.test(words[0]))words.shift()
    const program=(words[0]||'').replaceAll('\\','/').split('/').at(-1).replace(/\.exe$/i,'').toLowerCase()
    if(CLIENTS.has(program)) {
      const flags=new Set(['-c','--command','-e','--execute','-q','-query','-command','-sql'])
      for(let i=1;i<words.length;i++) {
        if(flags.has(words[i].toLowerCase())&&words[i+1])found.push(words[++i])
        else if(/^(?:--command|--execute)=/i.test(words[i]))found.push(words[i].split('=').slice(1).join('='))
      }
      if(program==='sqlite3'&&words.length>2)found.push(words.slice(2).join(' '))
    } else if(['node','python','python3','py','pwsh'].includes(program)) {
      const flag=words.findIndex(w=>['-e','-c','-command'].includes(w.toLowerCase()))
      const code=flag>=0?words[flag+1]:undefined
      if(code&&/\.(?:execute|executemany|exec|query)\s*\(/i.test(code)) {
        for(const literal of code.matchAll(/(['"])((?:\\.|(?!\1)[\s\S])*?)\1/g)) {
          if(/^\s*(?:WITH|UPDATE|DELETE|DROP|TRUNCATE|SELECT)\b/i.test(literal[2]))found.push(literal[2])
        }
      }
    }
  }
  return found
}
function statements(sql) {
  const out=[]; let tokens=[]; let depth=0
  for(let i=0;i<sql.length;) {
    const c=sql[i]
    if(/\s/.test(c)){i++;continue}
    if(sql.startsWith('--',i)){const end=sql.indexOf('\n',i);i=end<0?sql.length:end+1;continue}
    if(sql.startsWith('/*',i)){const end=sql.indexOf('*/',i+2);i=end<0?sql.length:end+2;continue}
    if(c==="'"||c==='"'||c==='`'||c==='[') {
      const end=c==='['?']':c;const literal=c==="'";i++
      while(i<sql.length){if(sql[i]===end){if(sql[i+1]===end){i+=2;continue};i++;break};if(sql[i]==='\\'&&literal)i++;i++}
      tokens.push({word:literal?'STRING':'IDENT',depth});continue
    }
    if(c===';'&&depth===0){if(tokens.length)out.push(tokens);tokens=[];i++;continue}
    if(c==='('){tokens.push({word:c,depth});depth++;i++;continue}
    if(c===')'){depth=Math.max(0,depth-1);tokens.push({word:c,depth});i++;continue}
    const word=/^[\w$]+/.exec(sql.slice(i))
    tokens.push({word:word?word[0].toUpperCase():c,depth});i+=word?word[0].length:1
  }
  if(tokens.length)out.push(tokens)
  return out
}
// Evaluate only proven boolean constants; everything else remains unknown.
function constantBoolean(input, level = 0) {
  if (!input.length || input.length > 2048 || level > 24) return undefined
  let part = input
  while (part[0]?.word === '(' && part.at(-1)?.word === ')') {
    const close = part.findIndex(t => t.word === ')' && t.depth === part[0].depth)
    if (close !== part.length - 1) break
    part = part.slice(1, -1)
  }
  if (!part.length) return undefined
  const base = Math.min(...part.map(t => t.depth))
  for (const operator of ['OR', 'AND']) {
    const splits = part.map((t,i) => t.depth === base && t.word === operator ? i : -1).filter(i => i >= 0)
    if (!splits.length) continue
    const values = []; let start = 0
    for (const end of [...splits, part.length]) { values.push(constantBoolean(part.slice(start,end),level+1)); start=end+1 }
    return operator === 'OR' ? values.includes(true) ? true : values.every(v=>v===false) ? false : undefined
      : values.includes(false) ? false : values.every(v=>v===true) ? true : undefined
  }
  if (part[0].word === 'NOT') { const value=constantBoolean(part.slice(1),level+1); return value === undefined ? undefined : !value }
  const words=part.map(t=>t.word)
  if (words.length===1 && ['TRUE','FALSE'].includes(words[0])) return words[0]==='TRUE'
  if (words.length===3 && /^\d+$/.test(words[0]) && words[1]==='=' && /^\d+$/.test(words[2])) return BigInt(words[0])===BigInt(words[2])
  return undefined
}
export function destructiveSqlRisk(name,args) {
  for(const sql of sqlCandidates(name,args))for(const tokens of statements(sql)) {
    const top=tokens.filter(t=>t.depth===0).map(t=>t.word)
    if(top.some((t,i)=>t==='DROP'&&['TABLE','DATABASE','SCHEMA'].includes(top[i+1]))||top.includes('TRUNCATE'))return 'destructive-ddl'
    const mutation=top.findIndex(t=>t==='UPDATE'||t==='DELETE')
    if(mutation<0)continue
    const where=top.indexOf('WHERE',mutation+1)
    if(where<0)return 'unconditional-mutation'
    const at=tokens.findIndex(t=>t.depth===0&&t.word==='WHERE')
    let condition=tokens.slice(at+1)
    const end=condition.findIndex(t=>t.depth===0&&['RETURNING','ORDER','LIMIT','FETCH'].includes(t.word))
    if(end>=0)condition=condition.slice(0,end)
    if(constantBoolean(condition)===true)return 'always-true-predicate'
  }
  return null
}
