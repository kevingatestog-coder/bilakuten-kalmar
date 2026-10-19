<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
fwrite(STDERR,"Läs lösenord från stdin. Klistra inte lösenord i kommandoraden.\n");
$password=rtrim(stream_get_contents(STDIN),"\r\n");
if (strlen($password)<16||strlen($password)>72) { fwrite(STDERR,"Lösenordet måste ha 16–72 byte.\n");exit(1); }
echo password_hash($password,PASSWORD_DEFAULT).PHP_EOL;
