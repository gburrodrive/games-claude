# Osso al Volo

Sei un cagnolino in spiaggia (pelo scuro, petto bianco, pettorina rossa con profili riflettenti e collare bianco con localizzatore). Il tuo umano lancia gli ossi: corri, salta, prendili al volo e mangiali. L'obiettivo è mangiarne il più possibile.

Per giocare apri `index.html` in un browser moderno. Non servono installazioni né server. I font arrivano da Google Fonts e, se non sono disponibili, il gioco usa quelli di sistema.

## Comandi

| Tasto | Azione |
| --- | --- |
| ← → (o A D) | Corri: il cane passa da solo da passo a trotto a galoppo |
| Maiusc | Scatto (25 km/h), consuma il fiato in pochi secondi |
| ↑, W o Spazio | Salta; tieni premuto per saltare più in alto. Mentre mangi, premi per masticare più in fretta |
| B | Abbaia: vicino all'umano lo fa lanciare subito, vicino a un gabbiano lo spaventa |
| ↓ | Cammina piano per prendere la mira |
| P / Esc · M | Pausa · audio |

Su telefono e tablet compaiono i pulsanti a schermo. Funziona anche un gamepad (stick o croce per correre, A per saltare, X o B per abbaiare, grilletto destro per lo scatto).

## Regole

- **A tempo**: 2 minuti per mangiare più ossi possibile.
- **Senza fine**: la partita finisce quando perdi 3 ossi.
- L'umano lancia solo quando gli sei vicino. Ogni tanto fa una finta e spesso subito dopo lancia dall'altra parte.
- Punti per tipo di osso: biscotto 50, osso di pelle 100, osso annodato 180, osso di prosciutto 300. Gli ossi più grandi richiedono più tempo per essere mangiati.
- Moltiplicatori: presa in corsa (osso ancora in volo, cane a terra) ×1,5, presa al volo (cane in salto) ×2, presa all'apice del salto ×3, osso ripescato in acqua ×1,2, osso strappato al gabbiano ×1,5. Si aggiungono un bonus rapidità e un moltiplicatore di serie (+10% per ogni osso consecutivo, fino a ×2).
- Dal livello 6 i gabbiani reali (*Larus michahellis*) volteggiano sopra la spiaggia e scendono in picchiata sugli ossi rimasti a terra. Il mare si porta via gli ossi che finiscono oltre la profondità in cui un cane piccolo si avventura (circa 19 cm).

## Realismo: cosa c'è dietro

**Andature del cane.** Le zampe seguono un generatore di andatura con fasi sfalsate per ciascun arto, ispirato ai modelli CPG usati per i quadrupedi:

- passo laterale a 4 tempi (posteriore sinistro, anteriore sinistro, posteriore destro, anteriore destro), con appoggio intorno al 64% del ciclo;
- trotto a coppie diagonali, con appoggio al 45%;
- galoppo rotatorio, l'andatura preferita dai cani (sequenza circolare posteriore sinistro → posteriore destro → anteriore destro → anteriore sinistro). Ha due fasi di sospensione: in quella raccolta la colonna è flessa, in quella estesa è distesa. La flessione e l'estensione della colonna allungano il passo.

Durante l'appoggio il piede resta fermo a terra (nessuno scivolamento) e ogni zampa è risolta con una cinematica inversa a tre segmenti: omero, radio e metacarpo davanti; femore, tibia e metatarso dietro. Gomito e garretto si piegano dal lato anatomicamente giusto. In volo carpo e garretto si ripiegano, e il galoppo veloce li ripiega di più. La frequenza del passo cresce con la velocità, come nei cani piccoli. Coda e orecchie a rosa sono simulate con molle smorzate.

**Misure.** Il cane è alto circa 31 cm al garrese. Trotta fino a circa 11 km/h, galoppa a 18 km/h e scatta a 25 km/h, valori nell'intervallo misurato per i cani piccoli. Salta da 47 cm a 78 cm tenendo premuto. L'umano è alto circa 1,80 m.

**Lancio.** L'umano carica il braccio dietro la testa, fa un passo avanti con il piede opposto, ruota il busto, rilascia l'osso e accompagna il gesto. Per i tiri corti lancia dal basso. Il punto di caduta è calcolato con la balistica (gravità 9,81 m/s²) a partire dalla posizione reale della mano. In volo agiscono la resistenza dell'aria e il vento, e l'osso ruota su se stesso. Sulla sabbia asciutta rimbalza poco e si ferma per attrito, sulla sabbia bagnata scivola di più, in acqua galleggia e segue la risacca.

**Scena.** La camera è bassa come nella foto, con una vera prospettiva: la riva si allontana in diagonale verso l'orizzonte, ci sono dune con staccionata, pini domestici e un promontorio sullo sfondo. Le onde arrivano con il fronte che si rompe e la risacca, l'acqua cancella le impronte. Il cane e l'umano lasciano impronte, le ombre seguono il sole e c'è foschia sugli oggetti lontani.

## Giochi e fonti consultati

- [Puppy Catch](https://thenerdpoint60.itch.io/puppy-catch) e [Fetch (Small Paw Studios)](https://smallpawstudios.itch.io/fetch): giochi di riporto per browser.
- [Flying Disc](https://dinogame.gg/games/frisbee-game/): salto a tempo con bonus per le prese in aria e all'apice del salto.
- [Disc O'Dog](https://www.mariowiki.com/Disc_O%27Dog): mini-gioco basato sul tempismo del salto.
- [Chorny fetches a bone (Stanford Code in Place)](https://compedu.stanford.edu/codeinplace/public/projects/0491.html): il ciclo base del riporto.
- [Gaits (Gait Foot-Fall Patterns), Norecopa](https://norecopa.no/norina/gaits-gait-foot-fall-patterns) e [University of Minnesota, rotary gallop](https://vanat.ahc.umn.edu/gaits/rotGallop.html): sequenze di appoggio.
- [Biancardi e Minetti 2012, galoppo trasverso e rotatorio](https://www.originalwisdom.com/wp-content/uploads/bsk-pdf-manager/2019/10/Biancardi-and-Minetti_2012_Biomechanical-determinants-of-transverse-and-rotary-gallop-in-cursorial-mammals.pdf) e [Gait Analysis and Biomechanics of Quadruped Motion](https://ojs.bahria.edu.pk/index.php/bujict/article/view/178): flessione della colonna e generatori di andatura.
- [Animating Four-Legged Beasts (Game Developer)](https://www.gamedeveloper.com/art/animating-four-legged-beasts): traiettorie ad arco dei piedi.
- [Dogster: quanto corre un chihuahua](https://www.dogster.com/lifestyle/how-fast-can-a-chihuahua-run/) e [Dimensions.com: chihuahua](https://www.dimensions.com/element/chihuahua): velocità e misure.

## Struttura

```
index.html      pagina, stile, tabellone, menu
js/util.js      matematica, IK a due segmenti, spline, rumore
js/audio.js     suoni sintetizzati con Web Audio (abbaio, sgranocchio, onde, gabbiano, fischio)
js/scene.js     camera prospettica, spiaggia, mare, onde, impronte, particelle
js/bone.js      tipi di osso, fisica del volo, rimbalzi, galleggiamento
js/dog.js       il cane: andature, pose, scheletro, disegno
js/human.js     l'umano: keyframe del lancio, scheletro, disegno
js/gull.js      il gabbiano ladro
js/game.js      logica di gioco, input, camera, punteggi, pilota automatico della demo
js/ui.js        menu, tabellone, comandi touch, avvio
```

Il pilota automatico che muove il cane nella demo del menu serve anche per i test: `OAV.game.step()` permette di simulare intere partite in pochi secondi.
