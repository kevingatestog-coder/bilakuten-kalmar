<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
require __DIR__.'/app.php';
$options=getopt('',['days:','apply']);$days=filter_var($options['days']??180,FILTER_VALIDATE_INT,['options'=>['min_range'=>30,'max_range'=>3650]]);
if ($days===false) { fwrite(STDERR,"Ange --days mellan 30 och 3650.\n");exit(1); }
$db=\Bilakuten\connect(\Bilakuten\load_config(__DIR__));
$cutoff=gmdate('Y-m-d H:i:s',time()-$days*86400);
$count=\Bilakuten\query($db,"SELECT COUNT(*) FROM bk_bookings WHERE status IN ('completed','cancelled') AND updated_at < ?",[$cutoff])->fetchColumn();
echo $count." avslutade/avbokade förfrågningar är äldre än ".$days." dagar.\n";
if (array_key_exists('apply',$options)) { \Bilakuten\query($db,"DELETE FROM bk_bookings WHERE status IN ('completed','cancelled') AND updated_at < ?",[$cutoff]);echo "De matchande förfrågningarna har raderats.\n"; }
else echo "Förhandsgranskning: inget har raderats. Lägg till --apply endast om raderingen ska genomföras.\n";
