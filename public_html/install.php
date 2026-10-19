<?php
declare(strict_types=1);
ini_set('display_errors','0');
$private=dirname(__DIR__).'/bilakuten-private';
if (!is_file($private.'/app.php')) { http_response_code(503);header('Content-Type: text/plain; charset=utf-8');exit('Mappen bilakuten-private ska ligga bredvid public_html, inte inuti den.'); }
require $private.'/app.php';
require $private.'/install.php';
header('Cache-Control: no-store, private');
header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
try {
    \Bilakuten\require_https();
    $host=$_SERVER['HTTP_HOST']??'';
    if (!preg_match('/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/D',$host)) throw new \Bilakuten\HttpError(400,'Ogiltig domän.');
    $local=defined('BK_LOCAL_TESTING')&&BK_LOCAL_TESTING===true;
    $origin=($local?'http://':'https://').$host;
    if (($_SERVER['REQUEST_METHOD']??'GET')==='POST') {
        \Bilakuten\security_headers();\Bilakuten\same_origin(['site_origin'=>$origin]);
        \Bilakuten\install_site($private,\Bilakuten\json_body(),$origin);
        \Bilakuten\json_response(201,['ok'=>true]);
    }
    if (($_SERVER['REQUEST_METHOD']??'GET')!=='GET') throw new \Bilakuten\HttpError(405,'Metoden stöds inte.');
    if (is_file($private.'/config.php')||is_file($private.'/installed.lock')) {
        header('Content-Type: text/html; charset=utf-8');
        exit('<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redan installerat</title><link rel="stylesheet" href="assets/css/setup.css?v=0eab20d03b4a"><main><h1>Installationen är låst.</h1><p>Webbplatsen är redan installerad.</p><a href="/admin">Öppna administrationen →</a></main></html>');
    }
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__.'/setup.html');
} catch (\Bilakuten\HttpError $error) {
    \Bilakuten\security_headers();\Bilakuten\json_response($error->status,['error'=>$error->getMessage()]);
} catch (Throwable $error) {
    \Bilakuten\security_headers();error_log('Bilakuten installer failure: '.get_class($error));\Bilakuten\json_response(503,['error'=>'Installationen kunde inte slutföras. Kontrollera filrättigheter och PHP-inställningar.']);
}
