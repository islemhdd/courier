<?php
require 'C:\Users\user\Desktop\courier\vendor\autoload.php';
$r = new ReflectionMethod('PHPUnit\Framework\TestCase', 'run');
foreach ($r->getParameters() as $p) {
    $type = $p->getType();
    echo 'param: ' . $p->getName() . ' type: ' . ($type ? $type->getName() : 'none') . ' allownull: ' . ($p->allowsNull() ? 'yes' : 'no') . PHP_EOL;
}
// Also check what TestResult-like classes exist
echo PHP_EOL;
$classes = array_filter(get_declared_classes(), fn($c) => str_starts_with($c, 'PHPUnit\Framework\Test'));
echo "PHPUnit Test-like classes:" . PHP_EOL;
foreach ($classes as $c) echo "  $c" . PHP_EOL;
