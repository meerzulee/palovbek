import type { IngredientId } from './simulation';

export function FlyIllustration({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true">
    <ellipse cx="61" cy="107" rx="28" ry="4" fill="#264e40" opacity=".08" />
    <g stroke="#364238" strokeWidth="2.5" strokeLinecap="round"><path d="m47 76-18 8-6-4m24 1-13 16-8 1m41-22 21 9 7-3M69 83l11 16 8 2M47 65 32 59l-9 4m46 2 22-7 6 4" /></g>
    <ellipse cx="38" cy="52" rx="14" ry="26" transform="rotate(-42 38 52)" fill="#edf2dc" stroke="#b6c5a8" strokeWidth="1.4" />
    <ellipse cx="81" cy="49" rx="14" ry="26" transform="rotate(43 81 49)" fill="#edf2dc" stroke="#b6c5a8" strokeWidth="1.4" />
    <path d="m27 35 25 30M91 33 70 62" stroke="#b6c5a8" />
    <ellipse cx="59" cy="78" rx="18" ry="23" fill="#8f7652" />
    <path d="M44 83c9 6 22 6 31 0M46 93c8 3 17 3 25-1" stroke="#594b35" strokeWidth="5" />
    <path d="m49 69-4 22q15 12 29-1l-5-21" fill="#faf5e5" />
    <path d="M51 70v-7m16 7v-7M52 85h14v8H52z" stroke="#cfb998" strokeWidth="1.5" />
    <ellipse cx="59" cy="55" rx="21" ry="18" fill="#62553f" />
    <ellipse cx="44" cy="54" rx="10" ry="12" fill="#bb614c" /><ellipse cx="74" cy="54" rx="10" ry="12" fill="#bb614c" />
    <ellipse cx="43" cy="52" rx="3" ry="4" fill="#efd6b6"/><ellipse cx="73" cy="52" rx="3" ry="4" fill="#efd6b6"/>
    <path d="m55 65 5 3 5-3" stroke="#efddb8" strokeWidth="1.5" strokeLinecap="round" />
    <path d="m50 36-2-9m20 9 2-9" stroke="#403d2b" strokeWidth="2" />
    <path d="m35 31 7-12 18-9 18 9 7 12-25 11z" fill="#25242b" />
    <path d="m35 31 25 10 25-10v9L60 50 35 40z" fill="#24232a" />
    <path d="m36 33 24 10 24-10m-48 5 24 10 24-10M60 11v28" stroke="#cfc0e3" strokeWidth=".8" />
    <path d="M53 34c-1-12-14-15-13-7 1 5 6 3 5 0 4 0 7 4 8 7Zm14 0c1-12 14-15 13-7-1 5-6 3-5 0-4 0-7 4-8 7Z" stroke="#d9c8eb" strokeWidth="1.1" />
    <path d="m40 35 4 2v3l-4-2zm8 3 4 2v3l-4-2zm8 3 4 2v3l-4-2zm8 0 4-2v3l-4 2zm8-3 4-2v3l-4 2zm8-3 3-1v3l-3 1z" stroke="#d9c8eb" strokeWidth=".65" />
  </svg>;
}

export function IngredientIllustration({ type }: { type: IngredientId }) {
  return <svg viewBox="0 0 64 54" fill="none" aria-hidden="true">
    <ellipse cx="32" cy="46" rx="21" ry="3" fill="#665443" opacity=".08" />
    {type === 'oil' && <><path d="M26 10h12v8l5 8v16q-11 7-22 0V26l5-8z" fill="#e5b349" stroke="#b58b31"/><path d="M23 30h18v10q-9 5-18 0z" fill="#d89c27"/><rect x="25" y="5" width="14" height="8" rx="2" fill="#64755a"/><path d="M27 21v16" stroke="#f9e9ae" strokeWidth="3" strokeLinecap="round"/><path d="M29 28h9v10h-9z" fill="#f6eacb"/><path d="m33 30-2 4h4z" fill="#798254"/></>}
    {type === 'onion' && <><path d="M30 15 29 7l6 7C55 23 51 45 33 45 12 46 9 25 30 15" fill="#c89eaf"/><path d="M31 15C14 31 22 44 32 45m2-30c15 15 11 28 0 30m-2-30v29" stroke="#a27590" strokeWidth="1.5"/><path d="m30 12 8-7" stroke="#7c8558" strokeWidth="2"/><path d="M32 45v3m3-4 3 3" stroke="#a38a67"/></>}
    {type === 'lamb' && <><path d="m13 23 19-8 18 9-5 17-22 3-12-9z" fill="#b97565"/><path d="m13 23 17 7 20-6-5 17-22 3-12-9" fill="#c9917d"/><path d="m30 30-7 14m7-14 2-15" stroke="#f0d4bc" strokeWidth="3"/><path d="m19 25 7-4 5 3-7 3zM34 34l7-4 4 2-5 5z" fill="#efc9b3"/></>}
    {type === 'carrot' && <><path d="M18 39C10 49 18 45 36 29c8-9-2-15-7-8z" fill="#df873e"/><path d="M26 43c-5 8 0 5 18-14 7-9-3-14-8-6z" fill="#eea04c"/><path d="m35 21 4-13m-4 13 10-9m-6 13 11-7m-11 7 6-16" stroke="#66834f" strokeWidth="3" strokeLinecap="round"/><path d="m23 31 4 2m8-2 3 3m-8 3 3 2" stroke="#bb652d" strokeWidth="1.5"/></>}
    {type === 'spice' && <><path d="M12 31h40q-1 16-20 16T12 31" fill="#6f8d8e"/><ellipse cx="32" cy="31" rx="20" ry="7" fill="#ded2b9"/><ellipse cx="32" cy="31" rx="16" ry="5" fill="#a58a5b"/>{Array.from({length: 12}, (_, i) => <path key={i} d={`m${21+(i*7)%23} ${28+(i*3)%6} 2 1`} stroke="#705f40" strokeWidth="1.3"/>)}<path d="M17 38q16 11 30 0" stroke="#e6deca" strokeWidth="2"/></>}
    {type === 'garlic' && <><path d="m28 18 3-12 4 11c19 7 21 27-2 29-25-1-24-22-5-28" fill="#eee1c7" stroke="#cbbc9f"/><path d="M29 18C16 35 24 44 31 45m4-27c13 16 6 26-2 27m-1-28v26" stroke="#d0bea5" strokeWidth="1.5"/><path d="m28 46 4 3 5-3" stroke="#a59a77"/></>}
    {type === 'quince' && <><path d="M13 32c-6-24 32-27 40-5-7 19-34 26-40 5Z" fill="#d9ad37"/><path d="M16 29q17 22 35-2L32 20Z" fill="#f3d774"/><path d="m29 13 3-6" stroke="#7c6d34" strokeWidth="3"/></>}
    {(type === 'chickpea' || type === 'raisin') && <><path d="M10 28h44q-3 20-22 20T10 28" fill="#527a73"/>{Array.from({length:18},(_,i)=><ellipse key={i} cx={17+(i*11)%31} cy={23+(i*7)%13} rx={type==='chickpea'?4:3} ry="3.5" fill={type==='chickpea'?'#dfc481':'#75452f'}/>)}<path d="M16 38q15 12 32 0" stroke="#dfd2a9" strokeWidth="2"/></>}
    {type === 'egg' && <>{[-11,11].map(x=><g key={x} transform={`translate(${32+x} 29) rotate(${x})`}><ellipse rx="10" ry="15" fill="#f4e9c8"/><ellipse cy="2" rx="6" ry="7" fill="#e7ac39"/></g>)}</>}
    {type === 'qazi' && <>{[20,31,42].map((x,i)=><g key={x}><ellipse cx={x} cy={27+i%2*8} rx="12" ry="10" fill="#704532"/><ellipse cx={x} cy={26+i%2*8} rx="10" ry="8" fill="#a2684e"/><path d={`m${x-4} ${24+i%2*8} 4 2m-1 3 3 1m3-6 2 2`} stroke="#e6c294" strokeWidth="2"/></g>)}</>}
    {type === 'quail' && <><ellipse cx="32" cy="28" rx="17" ry="13" fill="#b67a42"/><ellipse cx="18" cy="29" rx="5" ry="10" fill="#925c34"/><ellipse cx="46" cy="29" rx="5" ry="10" fill="#925c34"/><path d="m23 37-7 8m25-8 7 8" stroke="#d8b077" strokeWidth="7" strokeLinecap="round"/><path d="m16 44-3 3m35-3 3 3" stroke="#eee0bd" strokeWidth="4" strokeLinecap="round"/></>}
    {type === 'rice' && <><path d="M10 30h44q-2 17-22 17T10 30" fill="#597b79"/><ellipse cx="32" cy="30" rx="22" ry="8" fill="#dcd4bb"/><path d="M13 29q19-22 38 0" fill="#f4e7cb"/>{Array.from({length: 20}, (_, i) => <path key={i} d={`m${19+(i*7)%27} ${22+(i*3)%12} 2 -1`} stroke="#d5c19b" strokeWidth="1.3" strokeLinecap="round"/>)}<path d="M16 38q16 11 32 0" stroke="#e8dcc2" strokeWidth="2"/></>}
  </svg>;
}
