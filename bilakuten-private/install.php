<?php
declare(strict_types=1);
namespace Bilakuten;

use PDO;
use Throwable;

function install_site(string $private,array $input,string $origin): void {
    if (is_file($private.'/config.php')||is_file($private.'/installed.lock')) throw new HttpError(409,'Webbplatsen är redan installerad.');
    if (!is_file($private.'/install-key.php')) throw new HttpError(403,'Installationsnyckeln saknas.');
    $expected=require $private.'/install-key.php';
    $key=$input['installationKey']??'';
    if (!is_string($key)||!is_string($expected)||!hash_equals($expected,hash('sha256',$key))) throw new HttpError(403,'Fel installationsnyckel.');
    $password=$input['adminPassword']??null;
    if (!is_string($password)||mb_strlen($password,'UTF-8')<16||strlen($password)>72) throw new HttpError(400,'Välj ett administratörslösenord med minst 16 tecken och högst 72 byte.');
    if ($password!==($input['adminPasswordRepeat']??null)) throw new HttpError(400,'Lösenorden är inte lika.');
    $dbHost=text($input['dbHost']??null,1,255,'databasvärd');$dbName=text($input['dbName']??null,1,64,'databasnamn');$dbUser=text($input['dbUser']??null,1,100,'databasanvändare');
    if (!preg_match('/^[a-zA-Z0-9._-]+$/D',$dbHost)||!preg_match('/^[a-zA-Z0-9_-]+$/D',$dbName)) throw new HttpError(400,'Kontrollera databasvärd och databasnamn.');
    $dbPassword=$input['dbPassword']??null;
    if (!is_string($dbPassword)||strlen($dbPassword)<1||strlen($dbPassword)>512) throw new HttpError(400,'Fyll i databaslösenordet.');
    $port=filter_var($input['dbPort']??3306,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>65535]]);
    if ($port===false) throw new HttpError(400,'Kontrollera databasporten.');
    $config=['site_origin'=>$origin,'database'=>['host'=>$dbHost,'port'=>$port,'name'=>$dbName,'user'=>$dbUser,'password'=>$dbPassword],'admin_password_hash'=>password_hash($password,PASSWORD_DEFAULT),'app_secret'=>bin2hex(random_bytes(32))];
    $lock=fopen($private.'/.install.lock','c');
    if (!$lock||!flock($lock,LOCK_EX)) throw new HttpError(503,'Kunde inte låsa installationsmappen.');
    try {
        if (is_file($private.'/config.php')||is_file($private.'/installed.lock')) throw new HttpError(409,'Webbplatsen är redan installerad.');
        try { $db=connect($config);query($db,'SELECT 1'); }
        catch (Throwable) { throw new HttpError(400,'Databasen kunde inte anslutas. Kontrollera uppgifterna i Simplys kontrollpanel.'); }
        $sql=file_get_contents($private.'/schema.sql');
        if ($sql===false) throw new HttpError(503,'Databasfilen saknas.');
        try {
            foreach (explode(';',$sql) as $statement) if (trim($statement)!=='') $db->exec($statement);
            if (query($db,"SELECT setting_value FROM bk_meta WHERE setting_name='schema_version'")->fetchColumn()!=='1') throw new HttpError(409,'Databasen har en annan version. Återställ konfigurationen istället för att installera på nytt.');
        } catch (HttpError $error) { throw $error; }
        catch (Throwable) { throw new HttpError(400,'Databastabellerna kunde inte skapas. Kontrollera databasbehörigheterna eller importera schema.sql i phpMyAdmin och försök igen.'); }
        $content="<?php\n// Private configuration. Never place this file inside public_html.\nreturn ".var_export($config,true).";\n";
        // Write the entire private configuration before making it visible to API requests.
        $temporary=tempnam($private,'.config-');
        if ($temporary===false) throw new HttpError(503,'Kunde inte spara konfigurationen.');
        chmod($temporary,0600);
        if (file_put_contents($temporary,$content,LOCK_EX)!==strlen($content)||!rename($temporary,$private.'/config.php')) { @unlink($temporary);throw new HttpError(503,'Konfigurationen kunde inte sparas. Kontrollera skrivrättigheterna.'); }
        // Existing config itself also permanently closes the installer.
        file_put_contents($private.'/installed.lock',gmdate('c')."\n",LOCK_EX);
        @unlink($private.'/install-key.php');
    } finally { flock($lock,LOCK_UN);fclose($lock); }
}
