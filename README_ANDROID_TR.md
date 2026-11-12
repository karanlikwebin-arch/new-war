# New War - Android 3D prototipi

Unity kullanmayan Android uygulamasi WebView icinde Three.js/WebGL ile 3D sahne cizer.
Harita duz zemin, birkac siper kutusu ve hedef tahtasindan olusur; agac/bitki yoktur.
Karakter, FBX dosyalarindaki ayni Mixamo rig'i kullanir. `tools/build_character_glb.py`
yedi klibi tek `soldier.glb` dosyasinda birlestirir: idle, yurume, geri adim, zipla,
inis, prone ve olum. `tools/build_weapons_glb.py`, depodaki `ar70_pbr.FBX` ve `akm.fbx`
dosyalarini Android icin GLB'ye cevirir; ekrandaki **DEGISTIR** dugmesi iki modeli
birbirine cevirir. FBX'lerde referans verilen ayri PBR texture dosyalari depoda olmadigi
icin donusumde renk/metallic/roughness malzemeleri kullanilir. Ates ve doldur animasyon
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
oyun otomatik baslar, acilis ekraninda "DEVAM ET" dugmesi yoktur. Ates/nisan,
zipla/yat-kalk, silah degistirme ve kamera dugmeleri ikonlarla gosterilir.
Atis sirasinda Backstep klibi ile silah geri tepmesi birlikte oynatilir. Sarjor mermi
bitince otomatik dolar. Ekranda skor/mermi/hedef yazisi yoktur.
Hedef tahtasina uc isabet skor kazandirir. Telefon/emulator bagliysa
`adb install -r app/build/outputs/apk/debug/app-debug.apk` ile kurun.

Release APK icin `app/build.gradle` signing ayari eklenip kendi keystore'unuzla
imzalanmalidir. Gizli anahtar veya sifreleri depoya koymayin.
