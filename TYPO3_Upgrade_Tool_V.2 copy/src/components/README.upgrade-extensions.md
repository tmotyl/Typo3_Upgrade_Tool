# Rozszerzenia w procesie aktualizacji TYPO3

Od wersji 2.0 narzędzie do aktualizacji TYPO3 wspiera uwzględnienie rozszerzeń w każdym kroku aktualizacji, a nie tylko w ostatnim.

Wcześniej, gdy aktualizacja składała się z wielu kroków (np. 10.4 → 11.5 → 12.4), rozszerzenia były uwzględniane tylko w ostatnim kroku. Teraz, każda komenda aktualizacyjna zawiera wszystkie rozszerzenia, co pomaga upewnić się, że są one kompatybilne z każdą pośrednią wersją.

## Wprowadzone zmiany

Zmiany w tej funkcjonalności obejmują:

1. Modyfikację funkcji `calculateUpgradePath()` - aby pobierać komendy aktualizacyjne dla każdego kroku
2. Aktualizację funkcji `getUpgradeSteps()` - aby używać listy rozszerzeń dla każdej wersji docelowej
3. Udoskonalenie funkcji `generateUpgradeCommand()` - dla lepszej czytelności wygenerowanych komend

## Przykład nowego zachowania

```
# Aktualizacja 10.4 → 11.5
composer require typo3/cms-core:"^11.5" vendor/extension1 vendor/extension2 # Included 2 extensions in this step -W

# Aktualizacja 11.5 → 12.4
composer require typo3/cms-core:"^12.4" vendor/extension1 vendor/extension2 # Included 2 extensions in this step -W
```

## Korzyści

- Rozszerzenia są sprawdzane na kompatybilność z każdą pośrednią wersją TYPO3
- Łatwiejsza identyfikacja problemów z rozszerzeniami na wcześniejszych etapach aktualizacji
- Bardziej kompletne instrukcje aktualizacji dla każdego etapu
- Większa przejrzystość procesu aktualizacji


