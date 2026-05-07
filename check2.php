<?php
require 'C:\Users\user\Desktop\courier\vendor\autoload.php';

// Check PHPUnit TestCase::setUp attributes
$r = new ReflectionMethod('PHPUnit\Framework\TestCase', 'setUp');
echo "PHPUnit TestCase::setUp attributes: " . count($r->getAttributes()) . "\n";
foreach ($r->getAttributes() as $a) {
    echo "  " . $a->getName() . "\n";
}

// Check Laravel TestCase::setUp attributes
$r2 = new ReflectionMethod('Illuminate\Foundation\Testing\TestCase', 'setUp');
echo "Laravel TestCase::setUp attributes: " . count($r2->getAttributes()) . "\n";
foreach ($r2->getAttributes() as $a) {
    echo "  " . $a->getName() . "\n";
}
