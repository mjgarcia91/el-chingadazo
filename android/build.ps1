param([switch]$InitializeSigning,[switch]$UsbTest,[switch]$NativeAccess,[switch]$NativePos)
$ErrorActionPreference='Stop'
if($UsbTest -and $NativeAccess){throw 'Choose one APK variant only.'}
if($NativePos -and ($UsbTest -or $NativeAccess)){throw 'Choose one APK variant only.'}
$projectRoot=Split-Path $PSScriptRoot -Parent
$jdk=Get-ChildItem "$projectRoot/.android-tools/java" -Directory | Select-Object -First 1
if(!$jdk){throw 'Install JDK 21 under .android-tools/java first.'}
$previousJava=$env:JAVA_HOME
$env:JAVA_HOME=$jdk.FullName
$sdk="$projectRoot/.android-tools/sdk"
$bt="$sdk/build-tools/35.0.0"
$androidJar="$sdk/platforms/android-35/android.jar"
function Invoke-Checked([string]$exe,[string[]]$params){& $exe @params; if($LASTEXITCODE -ne 0){throw "Build tool failed: $exe"}}
try {
 # Each build gets a new directory; never recursively remove the user's checkout.
 $build=Join-Path $PSScriptRoot ('build/'+[Guid]::NewGuid().ToString('N'))
 foreach($dir in @($build,"$build/classes","$build/dex","$build/test","$PSScriptRoot/dist")){New-Item -ItemType Directory -Force -Path $dir | Out-Null}
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/PrinterCore.java","$PSScriptRoot/test/PrinterCoreTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.PrinterCoreTest')
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativeImagePath.java","$PSScriptRoot/test/NativeAccessTest.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeAccess.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeRoutes.java","$PSScriptRoot/test/NativeImagePathTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.NativeImagePathTest')
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/WebViewDiagnostics.java","$PSScriptRoot/test/WebViewDiagnosticsTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.WebViewDiagnosticsTest')
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/UsbTestCommands.java","$PSScriptRoot/test/UsbTestCommandsTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.UsbTestCommandsTest')
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativeAccess.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeRoutes.java","$PSScriptRoot/test/NativeAccessTest.java","$PSScriptRoot/test/NativeRoutesTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.NativeAccessTest')
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.NativeRoutesTest')
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativeScreenState.java","$PSScriptRoot/test/NativeScreenStateTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.NativeScreenStateTest')
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativeSales.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeCatalog.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeDrafts.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeDraftContexts.java","$PSScriptRoot/test/NativeSalesTest.java","$PSScriptRoot/test/NativeCatalogTest.java","$PSScriptRoot/test/NativeDraftsTest.java","$PSScriptRoot/test/NativeDraftContextsTest.java")
 foreach($testName in @('NativeSalesTest','NativeCatalogTest','NativeDraftsTest','NativeDraftContextsTest')){Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",("hn.chingadazo.pos."+$testName))}
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativeTables.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeRelease.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeConsumption.java","$PSScriptRoot/test/NativeDiningAccessTest.java","$PSScriptRoot/test/NativeTablesTest.java","$PSScriptRoot/test/NativeReleaseTest.java","$PSScriptRoot/test/NativeConsumptionTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativeTableChanges.java","$PSScriptRoot/test/NativeTableChangesTest.java")
 foreach($testName in @('NativeDiningAccessTest','NativeTablesTest','NativeReleaseTest','NativeConsumptionTest','NativeTableChangesTest')){Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",("hn.chingadazo.pos."+$testName))}
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativeShifts.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeShiftJournal.java","$PSScriptRoot/test/NativeShiftsTest.java","$PSScriptRoot/test/NativeShiftJournalTest.java")
 foreach($testName in @('NativeShiftsTest','NativeShiftJournalTest')){Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",("hn.chingadazo.pos."+$testName))}
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativeEffects.java","$PSScriptRoot/test/NativeEffectsTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.NativeEffectsTest')
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativeReceipt.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeCheckout.java","$PSScriptRoot/src/hn/chingadazo/pos/NativePaidEffects.java","$PSScriptRoot/src/hn/chingadazo/pos/NativeCounterCheckout.java","$PSScriptRoot/test/NativeReceiptTest.java","$PSScriptRoot/test/NativeCheckoutTest.java","$PSScriptRoot/test/NativeCounterTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.NativeCounterTest')
 foreach($testName in @('NativeReceiptTest','NativeCheckoutTest')){Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",("hn.chingadazo.pos."+$testName))}
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativePaymentPreparation.java","$PSScriptRoot/test/NativePaymentPreparationTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.NativePaymentPreparationTest')
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" @('-encoding','UTF-8','-cp',"$build/test",'-d',"$build/test","$PSScriptRoot/src/hn/chingadazo/pos/NativePaymentService.java","$PSScriptRoot/test/NativePaymentServiceTest.java")
 Invoke-Checked "$env:JAVA_HOME/bin/java.exe" @('-cp',"$build/test",'hn.chingadazo.pos.NativePaymentServiceTest')
 $manifestPath=if($NativePos){"$PSScriptRoot/AndroidManifest-native-pos.xml"}elseif($NativeAccess){"$PSScriptRoot/AndroidManifest-native-access.xml"}elseif($UsbTest){"$PSScriptRoot/AndroidManifest-usb-test.xml"}else{"$PSScriptRoot/AndroidManifest.xml"}
 Invoke-Checked "$bt/aapt2.exe" @('compile','--dir',"$PSScriptRoot/res",'-o',"$build/resources.zip")
 $assetArgs=if($NativePos){@('-A',"$projectRoot/assets")}else{@()}
 Invoke-Checked "$bt/aapt2.exe" (@('link','-o',"$build/base.apk",'-I',$androidJar,'--manifest',$manifestPath,"$build/resources.zip")+$assetArgs)
 $sourceNames=if($NativeAccess){@('NativeAccess.java','NativeRoutes.java','NativeHttp.java','NativeVault.java','NativeScreenState.java','NativeAccessActivity.java')}elseif($UsbTest){@('PrinterCore.java','UsbPrinter.java','UsbTestCommands.java','UsbTestActivity.java')}else{@('PrinterCore.java','UsbPrinter.java','MainActivity.java','WebViewDiagnostics.java')}
 if($NativePos){$sourceNames=@('NativeAccess.java','NativeRoutes.java','NativeHttp.java','NativeVault.java','NativeScreenState.java','NativeAccessActivity.java','NativeSales.java','NativeCatalog.java','NativeDrafts.java','NativeDraftStore.java','NativeLineEditor.java','NativeSalesView.java','NativePosActivity.java')}
  if($NativePos){$sourceNames+=@('NativeTables.java','NativeRelease.java','NativeTablesView.java','NativeConsumption.java','NativeDraftContexts.java','NativeTableChanges.java','NativeShifts.java','NativeShiftJournal.java','NativeShiftsView.java')}
  if($NativePos){$sourceNames+=@('NativeCheckout.java','NativeReceipt.java','NativePaymentPreparation.java','NativePaymentService.java')}
  if($NativePos){$sourceNames+=@('NativeEffects.java','NativePaidEffects.java','PrinterCore.java')}
  if($NativePos){$sourceNames+=@('NativePaymentsView.java','NativeUsb.java','UsbPrinter.java')}
  if($NativePos){$sourceNames+=@('NativeCounterCheckout.java')}
  if($NativePos){$sourceNames+=@('NativeImagePath.java','NativePictures.java')}
 $sources=@($sourceNames | ForEach-Object {"$PSScriptRoot/src/hn/chingadazo/pos/$_"})
 Invoke-Checked "$env:JAVA_HOME/bin/javac.exe" (@('-encoding','UTF-8','--release','8','-classpath',$androidJar,'-d',"$build/classes")+$sources)
 Invoke-Checked "$env:JAVA_HOME/bin/jar.exe" @('cf',"$build/classes.jar",'-C',"$build/classes",'.')
 Invoke-Checked "$bt/d8.bat" @('--release','--min-api','23','--lib',$androidJar,'--output',"$build/dex","$build/classes.jar")
 # Add DEX without changing resource compression/alignment; align before signing.
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $archive=[IO.Compression.ZipFile]::Open("$build/base.apk",[IO.Compression.ZipArchiveMode]::Update)
 try {[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,"$build/dex/classes.dex",'classes.dex',[IO.Compression.CompressionLevel]::Optimal) | Out-Null} finally {$archive.Dispose()}
 Invoke-Checked "$bt/zipalign.exe" @('-f','4',"$build/base.apk","$build/aligned.apk")
 $signing="$PSScriptRoot/signing";$key="$signing/release.jks";$secret="$signing/password.dpapi.xml"
 if(!(Test-Path $key)){
  if(!$InitializeSigning){throw 'First build: use -InitializeSigning. Keep the signing directory private and backed up.'}
  if(Test-Path $secret){throw 'Signing password exists but key is missing. Restore the key; do not generate a different release identity.'}
  New-Item -ItemType Directory -Force -Path $signing | Out-Null
  $random=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
  $env:CHINGADAZO_SIGN_PASSWORD=[Convert]::ToBase64String($random)
  ConvertTo-SecureString $env:CHINGADAZO_SIGN_PASSWORD -AsPlainText -Force | Export-Clixml -LiteralPath $secret
  Invoke-Checked "$env:JAVA_HOME/bin/keytool.exe" @('-genkeypair','-keystore',$key,'-storetype','JKS','-alias','chingadazo','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=El Chingadazo, O=El Chingadazo, C=HN','-storepass:env','CHINGADAZO_SIGN_PASSWORD','-keypass:env','CHINGADAZO_SIGN_PASSWORD')
 } else {
  $secure=Import-Clixml -LiteralPath $secret
  $env:CHINGADAZO_SIGN_PASSWORD=[Net.NetworkCredential]::new('',$secure).Password
 }
 [xml]$manifest=Get-Content $manifestPath
 $version=$manifest.manifest.GetAttribute('versionName','http://schemas.android.com/apk/res/android')
 $apk=if($NativeAccess){"$PSScriptRoot/dist/Chingadazo-Acceso-Nativo-$version.apk"}elseif($UsbTest){"$PSScriptRoot/dist/Chingadazo-Prueba-USB-$version.apk"}else{"$PSScriptRoot/dist/El-Chingadazo-$version.apk"}
 if($NativePos){$apk="$build/Chingadazo-Integrado-INTERNAL.apk"}
 Invoke-Checked "$bt/apksigner.bat" @('sign','--ks',$key,'--ks-key-alias','chingadazo','--ks-pass','env:CHINGADAZO_SIGN_PASSWORD','--key-pass','env:CHINGADAZO_SIGN_PASSWORD','--v1-signing-enabled','true','--v2-signing-enabled','true','--v4-signing-enabled','false','--out',$apk,"$build/aligned.apk")
 Invoke-Checked "$bt/apksigner.bat" @('verify','--verbose','--print-certs',$apk)
 Invoke-Checked "$bt/aapt.exe" @('dump','badging',$apk)
 Get-FileHash -LiteralPath $apk -Algorithm SHA256
 Write-Output "APK: $apk"
} finally {$env:CHINGADAZO_SIGN_PASSWORD=$null;$env:JAVA_HOME=$previousJava}
