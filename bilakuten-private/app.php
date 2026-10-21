<?php
declare(strict_types=1);
namespace Bilakuten;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PDOException;
use RuntimeException;
use Throwable;

const SERVICES = ['bilservice','felsokning','bromsservice','dack','ac','batteri','annat'];
const STATES = ['pending','confirmed','completed','cancelled'];

final class HttpError extends RuntimeException {
    public function __construct(public readonly int $status, string $message) { parent::__construct($message); }
}

function security_headers(): void {
    ini_set('display_errors','0');
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}

function json_response(int $status,array $value): never {
    http_response_code($status);
    echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
}

function json_body(): array {
    if (!preg_match('~^application/json(?:;|$)~i',$_SERVER['CONTENT_TYPE']??'')) throw new HttpError(415,'Ogiltigt format.');
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>16384) throw new HttpError(413,'Förfrågan är för stor.');
    $raw=file_get_contents('php://input',false,null,0,16385);
    if ($raw===false||strlen($raw)>16384) throw new HttpError(413,'Förfrågan är för stor.');
    try { $body=json_decode($raw,false,32,JSON_THROW_ON_ERROR); }
    catch (Throwable) { throw new HttpError(400,'Förfrågan kunde inte läsas.'); }
    if (!is_object($body)) throw new HttpError(400,'Ogiltig förfrågan.');
    return (array)$body;
}

function load_config(string $private): array {
    $path=$private.'/config.php';
    if (!is_file($path)) throw new HttpError(503,'Bokningen är inte aktiverad ännu. Ring 076-240 77 63.');
    $config=require $path;
    if (!is_array($config)||empty($config['site_origin'])||empty($config['admin_password_hash'])||strlen($config['app_secret']??'')<32) throw new HttpError(503,'Bokningen behöver konfigureras.');
    return $config;
}

function connect(array $config): PDO {
    $db=$config['database'];
    if (!preg_match('/^[a-zA-Z0-9._-]+$/',$db['host']??'')||!preg_match('/^[a-zA-Z0-9_-]+$/',$db['name']??'')) throw new HttpError(503,'Databasanslutningen behöver konfigureras.');
    return new PDO('mysql:host='.$db['host'].';port='.(int)($db['port']??3306).';dbname='.$db['name'].';charset=utf8mb4',$db['user'],$db['password'],[
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES=>false,
        PDO::ATTR_TIMEOUT=>5,
        PDO::MYSQL_ATTR_INIT_COMMAND=>"SET time_zone = '+00:00'"
    ]);
}

function query(PDO $db,string $sql,array $values=[]): \PDOStatement {
    $statement=$db->prepare($sql);$statement->execute($values);return $statement;
}

function same_origin(array $config): void {
    if (!hash_equals($config['site_origin'],$_SERVER['HTTP_ORIGIN']??'')) throw new HttpError(403,'Förfrågan måste komma från hemsidan.');
    $fetchSite=$_SERVER['HTTP_SEC_FETCH_SITE']??'';
    if ($fetchSite!==''&&!in_array($fetchSite,['same-origin','none'],true)) throw new HttpError(403,'Förfrågan måste komma från hemsidan.');
}

function require_https(): void {
    $secure=!empty($_SERVER['HTTPS'])&&strtolower((string)$_SERVER['HTTPS'])!=='off';
    $local=defined('BK_LOCAL_TESTING')&&BK_LOCAL_TESTING===true&&in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true);
    if (!$secure&&!$local) throw new HttpError(426,'Öppna hemsidan via HTTPS för att använda bokningen.');
}

function now_stockholm(?DateTimeImmutable $now=null): DateTimeImmutable {
    return ($now??new DateTimeImmutable('now'))->setTimezone(new DateTimeZone('Europe/Stockholm'));
}

function times_for_date(mixed $date,?DateTimeImmutable $now=null): array {
    if (!is_string($date)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)) throw new HttpError(400,'Välj ett giltigt datum.');
    $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Europe/Stockholm'));
    if (!$parsed||$parsed->format('Y-m-d')!==$date) throw new HttpError(400,'Datumet finns inte.');
    $local=now_stockholm($now);$today=$local->format('Y-m-d');
    if ($date<$today||$date>$local->modify('+90 days')->format('Y-m-d')) throw new HttpError(400,'Välj en dag inom de kommande 90 dagarna.');
    $day=(int)$parsed->format('N');if ($day===7) return [];
    $start=$day===6?11:9;$end=$day===6?17:18;$times=[];
    for ($hour=$start;$hour<$end;$hour++) { $time=sprintf('%02d:00',$hour);if ($date!==$today||$time>$local->format('H:i')) $times[]=$time; }
    return $times;
}

function text(mixed $value,int $min,int $max,string $label): string {
    if (!is_string($value)) throw new HttpError(400,'Fyll i '.$label.'.');
    $value=trim($value);
    if (!mb_check_encoding($value,'UTF-8')||mb_strlen($value,'UTF-8')<$min||mb_strlen($value,'UTF-8')>$max||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$value)) throw new HttpError(400,'Kontrollera '.$label.'.');
    return $value;
}

function request_id(array $input): string {
    $id=$input['requestId']??null;
    if (!is_string($id)||!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD',$id)) throw new HttpError(400,'Uppdatera sidan och försök igen.');
    return strtolower($id);
}

function fingerprint(array $input): string {
    $values=[];foreach (['service','date','time','name','phone','email','registration','message','privacy'] as $key) $values[$key]=$input[$key]??'';
    return hash('sha256',json_encode($values,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
}

function validate_booking(array $input,?DateTimeImmutable $now=null): array {
    if (!empty($input['website'])) throw new HttpError(400,'Förfrågan kunde inte tas emot. Ring oss istället.');
    if (!in_array($input['service']??null,SERVICES,true)) throw new HttpError(400,'Välj en tjänst.');
    if (!in_array($input['time']??null,times_for_date($input['date']??null,$now),true)) throw new HttpError(400,'Välj en tid inom våra öppettider.');
    if (($input['privacy']??null)!==true) throw new HttpError(400,'Läs och godkänn informationen om förfrågan.');
    $name=text($input['name']??null,2,100,'namn');$phone=text($input['phone']??null,7,25,'telefonnummer');
    if (!preg_match('/^[+0-9 ()-]+$/D',$phone)||strlen(preg_replace('/\D/','',$phone))<7) throw new HttpError(400,'Kontrollera telefonnumret.');
    $email=text($input['email']??'',0,160,'e-postadress');
    if ($email!==''&&!filter_var($email,FILTER_VALIDATE_EMAIL)) throw new HttpError(400,'Kontrollera e-postadressen.');
    $registration=mb_strtoupper(text($input['registration']??null,2,12,'registreringsnummer'),'UTF-8');
    if (!preg_match('/^[A-ZÅÄÖ0-9 -]+$/uD',$registration)) throw new HttpError(400,'Kontrollera registreringsnumret.');
    return ['request_id'=>request_id($input),'service'=>$input['service'],'date'=>$input['date'],'time'=>$input['time'],'name'=>$name,'phone'=>$phone,'email'=>$email,'registration'=>$registration,'message'=>text($input['message']??'',0,2000,'beskrivningen')];
}

function saved_retry(PDO $db,string $id,string $fingerprint): ?array {
    $row=query($db,'SELECT reference,payload_hash,status FROM bk_bookings WHERE request_id=?',[$id])->fetch();
    if (!$row) return null;
    if (!hash_equals($row['payload_hash'],$fingerprint)) throw new HttpError(409,'Förfrågan har redan skickats med andra uppgifter. Uppdatera sidan för en ny förfrågan.');
    return ['reference'=>$row['reference'],'status'=>$row['status'],'duplicate'=>true];
}

function save_booking(PDO $db,array $input,?DateTimeImmutable $now=null): array {
    $id=request_id($input);$digest=fingerprint($input);$retry=saved_retry($db,$id,$digest);if ($retry) return $retry;
    $clean=validate_booking($input,$now);$stamp=($now??new DateTimeImmutable('now'))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    for ($attempt=0;$attempt<3;$attempt++) {
        $reference='BK-'.strtoupper(bin2hex(random_bytes(5)));
        try {
            query($db,'INSERT INTO bk_bookings(reference,request_id,payload_hash,service,date,time,name,phone,email,registration,message,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[$reference,$id,$digest,$clean['service'],$clean['date'],$clean['time'],$clean['name'],$clean['phone'],$clean['email'],$clean['registration'],$clean['message'],$stamp,$stamp]);
            return ['reference'=>$reference,'status'=>'pending'];
        } catch (PDOException $error) {
            if ($error->getCode()!=='23000') throw $error;
            $retry=saved_retry($db,$id,$digest);if ($retry) return $retry;
        }
    }
    throw new HttpError(503,'Förfrågan kunde inte sparas. Försök igen.');
}

function rate_limit(PDO $db,string $bucket,int $limit,int $window,?int $clock=null): void {
    $clock??=time();query($db,'DELETE FROM bk_rate_limits WHERE expires_at < ?',[$clock]);
    $db->beginTransaction();
    try {
        query($db,'INSERT INTO bk_rate_limits(bucket_hash,attempts,expires_at) VALUES(?,0,?) ON DUPLICATE KEY UPDATE bucket_hash=bucket_hash',[$bucket,$clock+$window]);
        $row=query($db,'SELECT attempts FROM bk_rate_limits WHERE bucket_hash=? FOR UPDATE',[$bucket])->fetch();
        if ((int)$row['attempts']>=$limit) { $db->rollBack();throw new HttpError(429,'För många försök. Vänta en stund eller ring 076-240 77 63.'); }
        query($db,'UPDATE bk_rate_limits SET attempts=attempts+1 WHERE bucket_hash=?',[$bucket]);$db->commit();
    } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack();throw $error; }
}

function session_token(): string {
    $token=$_COOKIE['bk_session']??'';return is_string($token)&&preg_match('/^[a-f0-9]{64}$/D',$token)?$token:'';
}

function require_admin(PDO $db,array $config): void {
    $token=session_token();
    $row=$token===''?false:query($db,'SELECT auth_tag,expires_at FROM bk_sessions WHERE token_hash=?',[hash('sha256',$token)])->fetch();
    if (!$row||(int)$row['expires_at']<=time()||!hash_equals($row['auth_tag'],hash('sha256',$config['admin_password_hash']))) throw new HttpError(401,'Logga in för att se bokningarna.');
}

function session_cookie(string $token,array $config,int $expires): void {
    setcookie('bk_session',$token,['expires'=>$expires,'path'=>'/','secure'=>str_starts_with($config['site_origin'],'https://'),'httponly'=>true,'samesite'=>'Strict']);
}

function handle_api(string $private): never {
    security_headers();
    try {
        require_https();
        $config=load_config($private);$method=$_SERVER['REQUEST_METHOD']??'GET';
        if (!in_array($method,['GET','POST','PATCH','DELETE'],true)) throw new HttpError(405,'Metoden stöds inte.');
        if ($method!=='GET') same_origin($config);
        $path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH);
        if ($path==='/api/availability'&&$method==='GET') json_response(200,['times'=>times_for_date($_GET['date']??null),'type'=>'requested-time']);
        $db=connect($config);
        $ip=$_SERVER['REMOTE_ADDR']??'unknown'; // Do not trust client-controlled forwarding headers.
        $bucket=hash_hmac('sha256',$ip,$config['app_secret']);
        if ($path==='/api/health'&&$method==='GET') {
            if (query($db,"SELECT setting_value FROM bk_meta WHERE setting_name='schema_version'")->fetchColumn()!=='1') throw new HttpError(503,'Bokningen behöver uppdateras.');
            json_response(200,['status'=>'ok']);
        }
        if ($path==='/api/bookings'&&$method==='POST') { $input=json_body();rate_limit($db,hash('sha256','booking:'.$bucket),12,3600);json_response(201,save_booking($db,$input)); }
        if ($path==='/api/admin/login'&&$method==='POST') {
            rate_limit($db,hash('sha256','login:'.$bucket),5,900);$input=json_body();$password=$input['password']??null;
            if (!is_string($password)||strlen($password)>72||!password_verify($password,$config['admin_password_hash'])) throw new HttpError(401,'Fel lösenord.');
            query($db,'DELETE FROM bk_sessions WHERE expires_at <= ?',[time()]);
            $token=bin2hex(random_bytes(32));$expiry=time()+28800;
            query($db,'INSERT INTO bk_sessions(token_hash,auth_tag,expires_at) VALUES(?,?,?)',[hash('sha256',$token),hash('sha256',$config['admin_password_hash']),$expiry]);session_cookie($token,$config,$expiry);json_response(200,['ok'=>true]);
        }
        if ($path==='/api/admin/logout'&&$method==='POST') { query($db,'DELETE FROM bk_sessions WHERE token_hash=?',[hash('sha256',session_token())]);session_cookie('',$config,time()-3600);json_response(200,['ok'=>true]); }
        if (str_starts_with((string)$path,'/api/admin/')) require_admin($db,$config);
        if ($path==='/api/admin/session'&&$method==='GET') json_response(200,['ok'=>true]);
        if ($path==='/api/admin/bookings'&&$method==='GET') json_response(200,['bookings'=>query($db,'SELECT reference,service,date,time,name,phone,email,registration,message,status,created_at,updated_at FROM bk_bookings ORDER BY date DESC,time DESC,created_at DESC')->fetchAll()]);
        if (preg_match('~^/api/admin/bookings/(BK-[A-F0-9]{10})$~D',(string)$path,$match)) {
            if ($method==='PATCH') {
                $input=json_body();if (!in_array($input['status']??null,STATES,true)) throw new HttpError(400,'Välj en giltig status.');
                if (!query($db,'SELECT reference FROM bk_bookings WHERE reference=?',[$match[1]])->fetch()) throw new HttpError(404,'Förfrågan hittades inte.');
                query($db,'UPDATE bk_bookings SET status=?,updated_at=? WHERE reference=?',[$input['status'],gmdate('Y-m-d H:i:s'),$match[1]]);json_response(200,['ok'=>true]);
            }
            if ($method==='DELETE') { if (query($db,'DELETE FROM bk_bookings WHERE reference=?',[$match[1]])->rowCount()===0) throw new HttpError(404,'Förfrågan hittades inte.');json_response(200,['ok'=>true]); }
        }
        throw new HttpError(404,'Sidan hittades inte.');
    } catch (HttpError $error) { json_response($error->status,['error'=>$error->getMessage()]); }
    catch (Throwable $error) { error_log('Bilakuten API failure: '.get_class($error).' code '.$error->getCode());json_response(503,['error'=>'Bokningen kan inte nås just nu. Försök igen eller ring 076-240 77 63.']); }
}
