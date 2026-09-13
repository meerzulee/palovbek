// This is an engineered readout, not a learned association with cooking.
// It uses actual output spikes; absent output falls back to a neutral recipe portion.
export function neuralPortion(outputHz:number,leftSpikes:number,rightSpikes:number) {
  const total=leftSpikes+rightSpikes;
  if(total===0)return {output_hz:outputHz,factor:1,hesitation:2,fallback:true};
  const balance=(rightSpikes-leftSpikes)/total;
  return {output_hz:outputHz,factor:Math.round((1+Math.max(-1,Math.min(1,balance))*.2)*100)/100,hesitation:outputHz<2?2:outputHz<10?1:0,fallback:false};
}
