"""Translate public copy locally. No text or personal data is sent to a service."""
import os,sys,pathlib,json,re,time,hashlib
os.environ['OPENBLAS_NUM_THREADS']='1'
os.environ['OMP_NUM_THREADS']='1'
root=pathlib.Path(__file__).resolve().parent.parent
if os.name=='nt':
    dlls=[os.add_dll_directory(str(root/'work/translation-runtime/vclibs')),os.add_dll_directory(str(root/'work/translation-runtime/Lib/site-packages/ctranslate2'))]
import ctranslate2,sentencepiece
mode=sys.argv[1] if len(sys.argv)>1 else 'ui'
source=json.loads((root/f'work/translations/{"ui" if mode=="ui" else "content"}-source.json').read_text('utf8'))
source=list(dict.fromkeys(re.sub(r'\s+',' ',s).strip() for s in source if s.strip()))
if mode=='content':
    derived=json.loads((root/'work/translations/content-derived.json').read_text('utf8'))
    derived_keys={re.sub(r'\s+',' ',entry['source']).strip() for entry in derived}
    source=[s for s in source if s not in derived_keys]
cachefile=root/f'work/translations/{mode}-cache.json'
cache=json.loads(cachefile.read_text('utf8')) if cachefile.exists() else {}
models={}
segmentfile=root/f'work/translations/segment-cache-{mode}.json'
legacy_segmentfile=root/'work/translations/segment-cache.json'
segment_source=segmentfile if segmentfile.exists() else legacy_segmentfile
segment_cache=json.loads(segment_source.read_text('utf8')) if segment_source.exists() else {}
def engine(pair):
    if pair not in models:
        folder=next((root/'work/translation-models'/pair).glob('*/sentencepiece.model')).parent
        models[pair]=(ctranslate2.Translator(str(folder/'model'),device='cpu',compute_type='int8',inter_threads=(2 if mode=='content' else 1),intra_threads=1),sentencepiece.SentencePieceProcessor(model_file=str(folder/'sentencepiece.model')))
    return models[pair]
def translate_batch(texts,pair):
    memory=segment_cache.setdefault(pair,{})
    for text in texts:
        if text.startswith('Bron:') or text.startswith('Bron bijgewerkt:'):
            memory[text]=text.replace('Bron bijgewerkt:','Source updated:' if pair.endswith('_en') else 'Source mise à jour le :').replace('Bron:','Source:')
    pending=list(dict.fromkeys(s for s in texts if s not in memory))
    if not pending:return [memory[s] for s in texts]
    model,tokenizer=engine(pair)
    tokens=[tokenizer.encode(s,out_type=str) for s in pending]
    results=model.translate_batch(tokens,beam_size=2,max_batch_size=16,batch_type='examples',max_input_length=512,max_decoding_length=512,repetition_penalty=1.0)
    for text,result in zip(pending,results):memory[text]=tokenizer.decode_pieces(result.hypotheses[0]).replace('▁',' ').strip()
    return [memory[s] for s in texts]
def pieces(text):
    # Keep variables, links, email addresses and paragraph boundaries exact.
    return re.split(r'(\{\d+\}|https?://\S+|[\w.+-]+@[\w.-]+\.\w+|[\U0001f000-\U0001ffff\u2600-\u27bf\ufe0f]+|\n+)',text)
def language(text):
    if mode=='ui':return 'nl'
    import langid
    return langid.classify(text[:2500])[0]
if mode!='ui':
    import langid
    langid.set_languages(['nl','en','fr'])
start=time.time()
def save():
    temporary=cachefile.with_suffix('.tmp');temporary.write_text(json.dumps(cache,ensure_ascii=False),encoding='utf8');temporary.replace(cachefile)
    temporary=segmentfile.with_suffix('.tmp');temporary.write_text(json.dumps(segment_cache,ensure_ascii=False),encoding='utf8');temporary.replace(segmentfile)
remaining=[s for s in source if s not in cache]
print(mode,'texts',len(source),'remaining',len(remaining),flush=True)
for offset in range(0,len(remaining),96):
    batch=remaining[offset:offset+96]
    print(mode,'classifying',offset,flush=True)
    entries=[(s,language(s),pieces(s)) for s in batch]
    print(mode,'classified',offset,flush=True)
    for s,lang,parts in entries:
        cache[s]={'en':s,'fr':s}
    for origin in ['nl','fr','en']:
        positions=[(s,i,p) for s,lang,parts in entries if lang==origin for i,p in enumerate(parts) if p.strip() and not re.fullmatch(r'[\U0001f000-\U0001ffff\u2600-\u27bf\ufe0f]+',p) and not re.fullmatch(r'\{\d+\}|https?://\S+|[\w.+-]+@[\w.-]+\.\w+|\n+',p)]
        if not positions:continue
        # Split at sentences before reaching the model's token window; never silently truncate.
        expanded=[]
        for s,i,p in positions:
            chunks=re.split(r'(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ])',p)
            fine=[]
            for chunk in chunks:
                if len(chunk)>500:
                    words=chunk.split();current=''
                    for word in words:
                        if len(current)+len(word)>450:fine.append(current);current=''
                        current+=((' ' if current else '')+word)
                    if current:fine.append(current)
                else:fine.append(chunk)
            expanded.extend((s,i,c) for c in fine if c.strip())
        strings=[x[2] for x in expanded]
        print(mode,origin,'segments',len(strings),'characters',sum(map(len,strings)),flush=True)
        english=strings if origin=='en' else translate_batch(strings,f'{origin}_en')
        print(mode,origin,'English ready',flush=True)
        french=strings if origin=='fr' else translate_batch(english,'en_fr')
        assembled={}
        for (s,i,p),en,fr in zip(expanded,english,french):
            assembled.setdefault((s,i),{'en':[],'fr':[]})['en'].append(en)
            assembled[(s,i)]['fr'].append(fr)
        for s,lang,parts in entries:
            if lang!=origin:continue
            for target in ['en','fr']:
                translated=[]
                for i,p in enumerate(parts):
                    if (s,i) in assembled:
                        value=' '.join(assembled[(s,i)][target]);translated.append((' ' if p.startswith(' ') else '')+value+(' ' if p.endswith(' ') else ''))
                    else:translated.append(p)
                cache[s][target]=''.join(translated)
    save()
    if offset%120==0:print(mode,'done',len(cache),'/',len(source),'seconds',round(time.time()-start),flush=True)
print(mode,'complete',len(cache),flush=True)
