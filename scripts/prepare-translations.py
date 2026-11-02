"""Offline translation setup. Models and runtime remain outside the website build."""
import os, pathlib, json, urllib.request, zipfile
urllib.request.install_opener(urllib.request.build_opener(urllib.request.HTTPCookieProcessor()))
urllib.request._opener.addheaders=[('User-Agent','CoteDeDuras-OfflineTranslations/1.0')]
root=pathlib.Path(__file__).resolve().parent.parent
os.environ['ARGOS_PACKAGES_DIR']=str(root/'work/translation-models')
index=json.load(urllib.request.urlopen('https://raw.githubusercontent.com/argosopentech/argospm-index/main/index.json'))
for source,target in [('nl','en'),('fr','en'),('en','fr')]:
    entry=next(p for p in index if p['from_code']==source and p['to_code']==target)
    folder=root/'work/translation-models'/f'{source}_{target}'
    if list(folder.glob('*/model/model.bin')): continue
    folder.mkdir(parents=True,exist_ok=True)
    destination=folder/'package.zip'
    print('Downloading',source,target,flush=True)
    urllib.request.urlretrieve(entry['links'][0],destination)
    with zipfile.ZipFile(destination) as package: package.extractall(folder)
    print('Installed',source,target,flush=True)
print('Models ready',flush=True)
