<?php
declare(strict_types=1);
ini_set('display_errors','0');
require dirname(__DIR__,2).'/bilakuten-private/app.php';
\Bilakuten\handle_api(dirname(__DIR__,2).'/bilakuten-private');
