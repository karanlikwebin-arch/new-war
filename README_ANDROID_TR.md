# New War - Android 3D prototipi

Unity kullanmayan Android uygulamasi WebView icinde Three.js/WebGL ile 3D sahne cizer.
Harita duz zemin, birkac siper kutusu ve hedef tahtasindan olusur; agac/bitki yoktur.
Karakter, FBX dosyalarindaki ayni Mixamo rig'i kullanir. `tools/build_character_glb.py`
yedi klibi tek `soldier.glb` dosyasinda birlestirir: idle, yurume, geri adim, zipla,
inis, prone ve olum. `tools/build_weapons_glb.py`, depodaki `ar70_pbr.FBX` ve `akm.fbx`
dosyalarini Android icin GLB'ye cevirir; ekrandaki **DEGISTIR** dugmesi iki modeli
birbirine cevirir. FBX'lerde referans verilen ayri PBR texture dosyalari depoda olmadigi
icin donusumde parca bazli metal/polimer renk, metallic ve roughness malzemeleri kullanilir.
Dokulu gorunum icin bu kaynak texture dosyalarinin ayrıca eklenmesi gerekir. Ates ve doldur animasyon
klipleri gelen dosyalar arasinda yok; ates geri tepmesi,
namlu parlamasi, iz efekti, ses ve doldurma hareketi oyun kodunda olusturulur.

## Derleme

Gerekenler: JDK 17, Android SDK Platform 36 / Build Tools ve Blender 4.x.
Gradle 8.13 wrapper projeye dahildir.

```sh
blender --background --python tools/build_character_glb.py
blender --background --python tools/build_weapons_glb.py
cd web && npm ci && npm run build && cd ..
./gradlew assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

Yatay ekranda sol joystick hareketi, sag ekranda saga surukleme saga; sola surukleme
sola doner. Yukari/asagi surukleme kamera egimini degistirir. Varsayilan gorunum birinci
sahistir; ustteki ikonlu dugmelerle birinci/ucuncu sahis secilir. Karakter yuklenince
oyun otomatik baslar, acilis ekraninda "DEVAM ET" dugmesi yoktur. Kamera ikonu
bastikca birinci sahis, arkadan takip ve serbest orbit modlari arasinda gecer. Serbest orbit
modunda sag ekrani surukleyerek karakterin etrafinda 360 derece bakilir.
Ates/nisan, zipla/yat-kalk, silah degistirme ve kamera dugmeleri ikonlarla gosterilir.
Silah karakterin sag el kemigine baglanir; iki kolun IK pozlari ates ve bekleme
durumlarinda tutusu korur.
Birinci sahis namlu parlamasi kamera silahinin namlu nesnesine baglidir; karakter
baslatma hatalari ekranda acik hata mesaji olarak gosterilir.
Silah modeli tetik kabzasi sag el pivotuna oturacak sekilde mesh olcek ve eksenlerine
gore hizalanir; dipcik omuza yakin, namlu ileri bakacak sekilde AR-70 ve AKM eksenleri
ayri ayri kalibre edilir. Ucuncu sahista silah eli ve namlu pitch'i karakterle izler.
Nisan dugmesi tek dokunmayla ADS ac/kapat yapar. Birinci sahista gercek modelin
gez/arpacik referans noktasina gore viewmodel yeri hizalanir; ADS sirasinda kamera
FOV'u 42 dereceye yumusakca iner. Viewmodel ayri bir sahnede
ikinci render gecisiyle cizilir ve ana sahnenin depth tamponu temizlenir; bu,
silah/ellerin duvar geometrisiyle kesismesini engeller (viewmodel yakin engellerin
onunde cizilir). Nisan disinda hareket salinimi ve atis geri tepmesi yumusatilmistir.
Atis sirasinda Backstep klibi ile silah geri tepmesi birlikte oynatilir. Sarjor mermi
bitince otomatik dolar. Ekranda skor/mermi/hedef yazisi yoktur.
Hedef tahtasina uc isabet skor kazandirir. Telefon/emulator bagliysa
`adb install -r app/build/outputs/apk/debug/app-debug.apk` ile kurun.

Release APK icin `app/build.gradle` signing ayari eklenip kendi keystore'unuzla
imzalanmalidir. Gizli anahtar veya sifreleri depoya koymayin.
