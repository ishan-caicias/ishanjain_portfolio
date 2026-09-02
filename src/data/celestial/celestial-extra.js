/* CELESTIAL EXTRA — bulk expansion layer of real, popularly-known objects.
   Compact rows expanded into full catalog entries and appended to window.CELESTIAL.
   Row: [id, name, designation, type(s|c|n|g), RA°, Dec°, ly, mag, spectral/class, constellation]
   Positions J2000, rounded; magnitudes apparent (V). */
(function () {
  "use strict";
  var X = [
  /* --- bright named stars (Hipparcos) --- */
  ["hadar","Hadar","β Centauri","s",210.96,-60.37,390,0.61,"B1 III","Centaurus"],
  ["acrux","Acrux","α Crucis","s",186.65,-63.10,320,0.77,"B0.5 IV","Crux"],
  ["mimosa","Mimosa","β Crucis","s",191.93,-59.69,280,1.25,"B0.5 III","Crux"],
  ["gacrux","Gacrux","γ Crucis","s",187.79,-57.11,89,1.63,"M3.5 III","Crux"],
  ["adhara","Adhara","ε Canis Majoris","s",104.66,-28.97,430,1.50,"B2 II","Canis Major"],
  ["castor","Castor","α Geminorum · sextuple","s",113.65,31.89,51,1.62,"A1 V ×6","Gemini"],
  ["shaula","Shaula","λ Scorpii · the Stinger","s",263.40,-37.10,570,1.63,"B2 IV","Scorpius"],
  ["bellatrix","Bellatrix","γ Orionis · Amazon Star","s",81.28,6.35,250,1.64,"B2 III","Orion"],
  ["elnath","Elnath","β Tauri","s",81.57,28.61,134,1.65,"B7 III","Taurus"],
  ["miaplacidus","Miaplacidus","β Carinae","s",138.30,-69.72,113,1.69,"A1 III","Carina"],
  ["alnilam","Alnilam","ε Orionis · Belt centre","s",84.05,-1.20,2000,1.69,"B0 Ia","Orion"],
  ["alnitak","Alnitak","ζ Orionis · Belt east","s",85.19,-1.94,1260,1.77,"O9.5 Ib","Orion"],
  ["mintaka","Mintaka","δ Orionis · Belt west","s",83.00,-0.30,1200,2.23,"O9.5 II","Orion"],
  ["saiph","Saiph","κ Orionis","s",86.94,-9.67,650,2.09,"B0.5 Ia","Orion"],
  ["alioth","Alioth","ε Ursae Majoris","s",193.51,55.96,81,1.77,"A1 III-IVp","Ursa Major"],
  ["dubhe","Dubhe","α UMa · Pointer","s",165.93,61.75,123,1.79,"K0 III","Ursa Major"],
  ["merak","Merak","β UMa · Pointer","s",165.46,56.38,80,2.37,"A1 V","Ursa Major"],
  ["phecda","Phecda","γ Ursae Majoris","s",178.46,53.69,83,2.44,"A0 V","Ursa Major"],
  ["megrez","Megrez","δ Ursae Majoris","s",183.86,57.03,80,3.31,"A3 V","Ursa Major"],
  ["alkaid","Alkaid","η UMa · Dipper's tail","s",206.89,49.31,104,1.86,"B3 V","Ursa Major"],
  ["wezen","Wezen","δ Canis Majoris","s",107.10,-26.39,1600,1.83,"F8 Ia","Canis Major"],
  ["mirzam","Mirzam","β CMa · the Announcer","s",95.67,-17.96,500,1.98,"B1 II-III","Canis Major"],
  ["aludra","Aludra","η Canis Majoris","s",111.02,-29.30,2000,2.45,"B5 Ia","Canis Major"],
  ["alhena","Alhena","γ Geminorum","s",99.43,16.40,109,1.92,"A1 IV","Gemini"],
  ["peacock","Peacock","α Pavonis","s",306.41,-56.74,180,1.94,"B2 IV","Pavo"],
  ["avior","Avior","ε Carinae","s",125.63,-59.51,600,1.86,"K3 III + B2 V","Carina"],
  ["alsephina","Alsephina","δ Velorum","s",131.18,-54.71,80,1.96,"A1 V","Vela"],
  ["atria","Atria","α Trianguli Australis","s",252.17,-69.03,390,1.91,"K2 II","Triangulum Australe"],
  ["alnair","Alnair","α Gruis","s",332.06,-46.96,101,1.74,"B6 V","Grus"],
  ["regor","Regor","γ² Velorum · Wolf-Rayet","s",122.38,-47.34,840,1.83,"WC8 + O7.5","Vela"],
  ["naos","Naos","ζ Puppis · runaway","s",120.90,-40.00,1080,2.25,"O4 If","Puppis"],
  ["suhail","Suhail","λ Velorum","s",137.00,-43.43,545,2.21,"K4 Ib","Vela"],
  ["diphda","Diphda","β Ceti","s",10.90,-17.99,96,2.02,"K0 III","Cetus"],
  ["mirfak","Mirfak","α Persei","s",51.08,49.86,510,1.80,"F5 Ib","Perseus"],
  ["algol","Algol","β Persei · Demon Star","s",47.04,40.96,90,2.12,"B8 V eclipsing","Perseus"],
  ["hamal","Hamal","α Arietis","s",31.79,23.46,66,2.00,"K2 III","Aries"],
  ["kochab","Kochab","β Ursae Minoris","s",222.68,74.16,131,2.08,"K4 III","Ursa Minor"],
  ["denebola","Denebola","β Leonis · Lion's tail","s",177.26,14.57,36,2.14,"A3 V","Leo"],
  ["algieba","Algieba","γ Leonis · golden double","s",154.99,19.84,130,2.28,"K1 III + G7 III","Leo"],
  ["alphard","Alphard","α Hydrae · the Solitary","s",141.90,-8.66,177,1.98,"K3 II-III","Hydra"],
  ["menkalinan","Menkalinan","β Aurigae","s",89.88,44.95,81,1.90,"A1 IV","Auriga"],
  ["alphecca","Alphecca","α CrB · Gemma","s",233.67,26.71,75,2.23,"A0 V","Corona Borealis"],
  ["unukalhai","Unukalhai","α Serpentis","s",236.07,6.43,74,2.63,"K2 III","Serpens"],
  ["rasalhague","Rasalhague","α Ophiuchi","s",263.73,12.56,49,2.07,"A5 III","Ophiuchus"],
  ["sabik","Sabik","η Ophiuchi","s",257.59,-15.72,88,2.43,"A2 V","Ophiuchus"],
  ["eltanin","Eltanin","γ Draconis · zenith star","s",269.15,51.49,154,2.24,"K5 III","Draco"],
  ["thuban","Thuban","α Draconis · pharaohs' pole star","s",211.10,64.38,300,3.65,"A0 III","Draco"],
  ["sadr","Sadr","γ Cygni · Swan's heart","s",305.56,40.26,1800,2.23,"F8 Ib","Cygnus"],
  ["albireo","Albireo","β Cygni · gold-sapphire pair","s",292.68,27.96,430,3.05,"K3 II + B8 V","Cygnus"],
  ["alderamin","Alderamin","α Cephei","s",319.64,62.59,49,2.51,"A8 V","Cepheus"],
  ["enif","Enif","ε Pegasi","s",326.05,9.88,690,2.38,"K2 Ib","Pegasus"],
  ["markab","Markab","α Pegasi","s",346.19,15.21,133,2.49,"A0 IV","Pegasus"],
  ["scheat","Scheat","β Pegasi","s",345.94,28.08,196,2.44,"M2 II-III","Pegasus"],
  ["algenib","Algenib","γ Pegasi","s",3.31,15.18,390,2.83,"B2 IV","Pegasus"],
  ["alpheratz","Alpheratz","α Andromedae","s",2.10,29.09,97,2.06,"B8 IVp","Andromeda"],
  ["mirach","Mirach","β Andromedae","s",17.43,35.62,197,2.07,"M0 III","Andromeda"],
  ["almach","Almach","γ Andromedae · coloured double","s",30.97,42.33,350,2.10,"K3 II + B9 V","Andromeda"],
  ["menkar","Menkar","α Ceti","s",45.57,4.09,250,2.54,"M1.5 III","Cetus"],
  ["mira","Mira","ο Ceti · the Wonderful","s",34.84,-2.98,300,3.04,"M7 III pulsating","Cetus"],
  ["zubenelgenubi","Zubenelgenubi","α Librae","s",222.72,-16.04,76,2.75,"A3 IV","Libra"],
  ["zubeneschamali","Zubeneschamali","β Librae · the green star?","s",229.25,-9.38,185,2.61,"B8 V","Libra"],
  ["dschubba","Dschubba","δ Scorpii","s",240.08,-22.62,400,2.29,"B0.3 IV","Scorpius"],
  ["sargas","Sargas","θ Scorpii","s",264.33,-43.00,300,1.86,"F1 II","Scorpius"],
  ["kaus","Kaus Australis","ε Sagittarii · Archer's bow","s",276.04,-34.38,143,1.85,"B9.5 III","Sagittarius"],
  ["nunki","Nunki","σ Sagittarii","s",283.82,-26.30,228,2.05,"B2.5 V","Sagittarius"],
  ["tarazed","Tarazed","γ Aquilae","s",296.56,10.61,395,2.72,"K3 II","Aquila"],
  ["sadalmelik","Sadalmelik","α Aquarii","s",331.45,-0.32,520,2.94,"G2 Ib","Aquarius"],
  ["sadalsuud","Sadalsuud","β Aquarii","s",322.89,-5.57,540,2.90,"G0 Ib","Aquarius"],
  ["ankaa","Ankaa","α Phoenicis","s",6.57,-42.31,82,2.40,"K0 III","Phoenix"],
  ["rasalgethi","Rasalgethi","α Herculis","s",258.66,14.39,360,3.35,"M5 II","Hercules"],
  ["kornephoros","Kornephoros","β Herculis","s",247.55,21.49,139,2.78,"G7 III","Hercules"],
  ["vindemiatrix","Vindemiatrix","ε Virginis · Grape Gatherer","s",195.54,10.96,110,2.83,"G8 III","Virgo"],
  ["porrima","Porrima","γ Virginis","s",190.42,-1.45,38,2.74,"F0 V binary","Virgo"],
  ["izar","Izar","ε Boötis · Pulcherrima","s",221.25,27.07,203,2.37,"K0 II + A2 V","Boötes"],
  ["muphrid","Muphrid","η Boötis","s",208.67,18.40,37,2.68,"G0 IV","Boötes"],
  ["corcaroli","Cor Caroli","α CVn · Charles' Heart","s",194.01,38.32,110,2.90,"A0 Vp","Canes Venatici"],
  ["alcyone","Alcyone","η Tauri · Pleiades' heart","s",56.87,24.11,440,2.87,"B7 III","Taurus"],
  ["garnet","Mu Cephei","Herschel's Garnet Star","s",325.88,58.78,2840,4.08,"M2 Ia hypergiant","Cepheus"],
  ["vycma","VY Canis Majoris","hypergiant · light takes 6h to circle it","s",110.74,-25.77,3900,7.9,"M5 Ia hypergiant","Canis Major"],
  ["denebalgedi","Deneb Algedi","δ Capricorni","s",326.76,-16.13,39,2.85,"A7 III","Capricornus"],
  ["taucet","Tau Ceti","nearest single Sun-like star","s",26.02,-15.94,11.9,3.50,"G8 V","Cetus"],
  ["epseri","Ran","ε Eridani · young Sun","s",53.23,-9.46,10.5,3.73,"K2 V","Eridanus"],
  ["cyg61","61 Cygni","Bessel's Flying Star","s",316.73,38.75,11.4,5.21,"K5 V + K7 V","Cygnus"],
  ["wolf359","Wolf 359","CN Leonis","s",164.12,7.01,7.9,13.5,"M6 V flare","Leo"],
  ["lalande","Lalande 21185","GJ 411","s",165.83,35.97,8.3,7.5,"M2 V","Ursa Major"],
  ["trappist","TRAPPIST-1","seven Earth-sized worlds","s",346.62,-5.04,40.7,18.8,"M8 V · 7 planets","Aquarius"],
  ["peg51","51 Pegasi","Helvetios · first exoplanet host","s",344.37,20.77,50.9,5.49,"G2 IV · 51 Peg b","Pegasus"],
  ["kepler452","Kepler-452","host of 'Earth's cousin'","s",296.06,44.28,1800,13.4,"G2 V · Kepler-452b","Cygnus"],
  ["kepler186","Kepler-186","five-planet system","s",298.68,43.95,580,14.6,"M1 V · Kepler-186f","Cygnus"],
  ["osiris","HD 209458","Osiris · first transiting planet","s",330.79,18.88,159,7.65,"G0 V · evaporating world","Pegasus"],
  ["sgra","Sagittarius A*","our galaxy's central black hole","s",266.42,-29.01,26000,17,"SMBH · 4.15M M☉","Sagittarius"],
  ["cygx1","Cygnus X-1","first confirmed black hole","s",299.59,35.20,7200,8.9,"O9.7 Iab + black hole","Cygnus"],
  ["velapulsar","Vela Pulsar","PSR J0835−4510","s",128.84,-45.18,960,23.6,"Pulsar · 11 rot/s","Vela"],
  ["firstpulsar","PSR B1919+21","LGM-1 · the first pulsar","s",290.87,21.90,2280,22.5,"Pulsar · 1.34 s","Vulpecula"],
  /* --- famous deep-sky beyond Messier --- */
  ["lmc","Large Magellanic Cloud","LMC · brightest satellite galaxy","g",80.89,-69.76,160000,0.9,"Magellanic spiral","Dorado"],
  ["smc","Small Magellanic Cloud","SMC","g",13.19,-72.83,200000,2.7,"Dwarf irregular","Tucana"],
  ["cena","Centaurus A","NGC 5128 · nearest radio galaxy","g",201.37,-43.02,12000000,6.8,"Elliptical · AGN","Centaurus"],
  ["needle","Needle Galaxy","NGC 4565","g",189.09,25.99,40000000,10.4,"Edge-on spiral","Coma Berenices"],
  ["fireworks","Fireworks Galaxy","NGC 6946 · 10 supernovae seen","g",308.72,60.15,25000000,9.6,"Face-on spiral","Cygnus"],
  ["3c273","3C 273","the first and brightest quasar","g",187.28,2.05,2400000000,12.9,"Quasar","Virgo"],
  ["doublecluster","Double Cluster","NGC 869 + 884 · h & χ Persei","c",34.75,57.13,7500,4.3,"Open cluster pair","Perseus"],
  ["47tuc","47 Tucanae","NGC 104 · southern jewel","c",6.02,-72.08,13000,4.09,"Globular cluster","Tucana"],
  ["rosette","Rosette Nebula","NGC 2237 / 2244","n",97.98,4.94,5200,4.8,"Emission nebula","Monoceros"],
  ["horsehead","Horsehead Nebula","Barnard 33 in IC 434","n",85.24,-2.46,1500,6.8,"Dark nebula","Orion"],
  ["flame","Flame Nebula","NGC 2024","n",85.43,-1.85,1350,10,"Emission nebula","Orion"],
  ["veil","Veil Nebula","Cygnus Loop · NGC 6960/6992","n",311.75,30.71,2400,7.0,"Supernova remnant","Cygnus"],
  ["northamerica","North America Nebula","NGC 7000","n",314.75,44.34,2590,4.0,"Emission nebula","Cygnus"],
  ["crescent","Crescent Nebula","NGC 6888","n",303.06,38.35,5000,7.4,"Wolf-Rayet shell","Cygnus"],
  ["pacman","Pacman Nebula","NGC 281","n",13.19,56.63,9500,7.4,"Emission nebula","Cassiopeia"],
  ["coalsack","Coalsack","the Emu's head · dark nebula","n",189.60,-62.50,600,7,"Dark nebula","Crux"],
  ["witchhead","Witch Head Nebula","IC 2118 · lit by Rigel","n",76.20,-7.20,900,13,"Reflection nebula","Eridanus"],
  /* --- the rest of the Messier catalog --- */
  ["m1","Crab Nebula","M1 · wreck of SN 1054","n",83.63,22.01,6500,8.4,"Supernova remnant","Taurus"],
  ["m2","Messier 2","M2 · NGC 7089","c",323.36,-0.82,37500,6.3,"Globular cluster","Aquarius"],
  ["m3","Messier 3","M3 · NGC 5272","c",205.55,28.38,33900,6.2,"Globular cluster","Canes Venatici"],
  ["m4","Messier 4","M4 · nearest globular","c",245.90,-26.53,7200,5.6,"Globular cluster","Scorpius"],
  ["m5","Messier 5","M5 · NGC 5904","c",229.64,2.08,24500,5.6,"Globular cluster","Serpens"],
  ["m6","Butterfly Cluster","M6 · NGC 6405","c",265.07,-32.22,1600,4.2,"Open cluster","Scorpius"],
  ["m7","Ptolemy Cluster","M7 · known since 130 CE","c",268.45,-34.79,980,3.3,"Open cluster","Scorpius"],
  ["m9","Messier 9","M9 · NGC 6333","c",259.80,-18.52,25800,7.7,"Globular cluster","Ophiuchus"],
  ["m10","Messier 10","M10 · NGC 6254","c",254.29,-4.10,14300,6.4,"Globular cluster","Ophiuchus"],
  ["m11","Wild Duck Cluster","M11 · NGC 6705","c",282.77,-6.27,6200,5.8,"Open cluster","Scutum"],
  ["m12","Messier 12","M12 · NGC 6218","c",251.81,-1.95,15700,6.7,"Globular cluster","Ophiuchus"],
  ["m13","Hercules Cluster","M13 · target of the Arecibo message","c",250.42,36.46,22200,5.8,"Globular cluster","Hercules"],
  ["m14","Messier 14","M14 · NGC 6402","c",264.40,-3.25,30300,7.6,"Globular cluster","Ophiuchus"],
  ["m15","Messier 15","M15 · densest core known","c",322.49,12.17,33600,6.2,"Globular cluster","Pegasus"],
  ["m18","Messier 18","M18 · NGC 6613","c",274.99,-17.13,4900,7.5,"Open cluster","Sagittarius"],
  ["m19","Messier 19","M19 · NGC 6273","c",255.66,-26.27,28700,7.5,"Globular cluster","Ophiuchus"],
  ["m21","Messier 21","M21 · NGC 6531","c",270.90,-22.49,4250,6.5,"Open cluster","Sagittarius"],
  ["m22","Sagittarius Cluster","M22 · NGC 6656","c",279.10,-23.90,10600,5.1,"Globular cluster","Sagittarius"],
  ["m23","Messier 23","M23 · NGC 6494","c",269.15,-19.02,2150,6.9,"Open cluster","Sagittarius"],
  ["m24","Small Sagittarius Star Cloud","M24 · a window through the dust","c",274.20,-18.55,10000,4.6,"Star cloud","Sagittarius"],
  ["m25","Messier 25","M25 · IC 4725","c",277.94,-19.12,2000,4.6,"Open cluster","Sagittarius"],
  ["m26","Messier 26","M26 · NGC 6694","c",281.32,-9.38,5000,8.0,"Open cluster","Scutum"],
  ["m28","Messier 28","M28 · NGC 6626","c",276.14,-24.87,17900,7.7,"Globular cluster","Sagittarius"],
  ["m29","Messier 29","M29 · NGC 6913","c",305.98,38.52,4000,7.1,"Open cluster","Cygnus"],
  ["m30","Messier 30","M30 · core-collapsed","c",325.09,-23.18,27100,7.7,"Globular cluster","Capricornus"],
  ["m32","Messier 32","M32 · Andromeda's satellite","g",10.67,40.87,2490000,8.1,"Compact elliptical","Andromeda"],
  ["m33","Triangulum Galaxy","M33 · Local Group's third spiral","g",23.46,30.66,2730000,5.7,"Spiral galaxy","Triangulum"],
  ["m34","Messier 34","M34 · NGC 1039","c",40.53,42.75,1400,5.5,"Open cluster","Perseus"],
  ["m35","Messier 35","M35 · NGC 2168","c",92.27,24.34,2800,5.3,"Open cluster","Gemini"],
  ["m36","Pinwheel Cluster","M36 · NGC 1960","c",84.05,34.14,4100,6.3,"Open cluster","Auriga"],
  ["m37","Messier 37","M37 · Auriga's richest","c",88.07,32.55,4500,6.2,"Open cluster","Auriga"],
  ["m38","Starfish Cluster","M38 · NGC 1912","c",82.17,35.85,4200,7.4,"Open cluster","Auriga"],
  ["m39","Messier 39","M39 · NGC 7092","c",322.95,48.43,825,4.6,"Open cluster","Cygnus"],
  ["m40","Winnecke 4","M40 · Messier's odd double star","s",185.55,58.08,510,8.4,"Optical double","Ursa Major"],
  ["m41","Messier 41","M41 · seen by Aristotle","c",101.50,-20.75,2300,4.5,"Open cluster","Canis Major"],
  ["m43","De Mairan's Nebula","M43 · Orion's companion","n",83.88,-5.27,1600,9.0,"Emission nebula","Orion"],
  ["m44","Beehive Cluster","M44 · Praesepe","c",130.10,19.67,577,3.7,"Open cluster","Cancer"],
  ["m46","Messier 46","M46 · with a planetary inside","c",115.44,-14.81,5400,6.1,"Open cluster","Puppis"],
  ["m47","Messier 47","M47 · NGC 2422","c",114.15,-14.48,1600,4.4,"Open cluster","Puppis"],
  ["m48","Messier 48","M48 · NGC 2548","c",123.43,-5.75,1500,5.8,"Open cluster","Hydra"],
  ["m49","Messier 49","M49 · Virgo Cluster giant","g",187.44,8.00,56000000,9.4,"Elliptical galaxy","Virgo"],
  ["m50","Heart-shaped Cluster","M50 · NGC 2323","c",105.70,-8.33,3200,5.9,"Open cluster","Monoceros"],
  ["m52","Messier 52","M52 · NGC 7654","c",351.20,61.59,4600,7.3,"Open cluster","Cassiopeia"],
  ["m53","Messier 53","M53 · NGC 5024","c",198.23,18.17,58000,8.3,"Globular cluster","Coma Berenices"],
  ["m54","Messier 54","M54 · another galaxy's core","c",283.76,-30.48,87400,8.4,"Globular cluster","Sagittarius"],
  ["m55","Messier 55","M55 · NGC 6809","c",294.99,-30.96,17600,7.4,"Globular cluster","Sagittarius"],
  ["m56","Messier 56","M56 · NGC 6779","c",289.15,30.18,32900,8.3,"Globular cluster","Lyra"],
  ["m58","Messier 58","M58 · NGC 4579","g",189.43,11.82,62000000,9.7,"Barred spiral","Virgo"],
  ["m59","Messier 59","M59 · NGC 4621","g",190.51,11.65,60000000,9.6,"Elliptical galaxy","Virgo"],
  ["m60","Messier 60","M60 · NGC 4649","g",190.92,11.55,55000000,8.8,"Elliptical galaxy","Virgo"],
  ["m61","Messier 61","M61 · NGC 4303","g",185.48,4.47,52500000,9.7,"Barred spiral","Virgo"],
  ["m62","Messier 62","M62 · NGC 6266","c",255.30,-30.11,22200,6.5,"Globular cluster","Ophiuchus"],
  ["m65","Messier 65","M65 · Leo Triplet","g",169.73,13.09,35000000,10.3,"Spiral galaxy","Leo"],
  ["m66","Messier 66","M66 · Leo Triplet","g",170.06,12.99,36000000,8.9,"Barred spiral","Leo"],
  ["m67","King Cobra Cluster","M67 · ancient open cluster","c",132.85,11.81,2610,6.1,"Open cluster · 4 Gyr","Cancer"],
  ["m68","Messier 68","M68 · NGC 4590","c",189.87,-26.74,33600,9.7,"Globular cluster","Hydra"],
  ["m69","Messier 69","M69 · NGC 6637","c",277.85,-32.35,29700,8.3,"Globular cluster","Sagittarius"],
  ["m70","Messier 70","M70 · NGC 6681","c",280.80,-32.29,29400,9.1,"Globular cluster","Sagittarius"],
  ["m71","Messier 71","M71 · NGC 6838","c",298.44,18.78,13000,6.1,"Globular cluster","Sagitta"],
  ["m72","Messier 72","M72 · NGC 6981","c",313.37,-12.54,54600,9.4,"Globular cluster","Aquarius"],
  ["m73","Messier 73","M73 · a four-star asterism","s",314.75,-12.63,2500,9.0,"Asterism","Aquarius"],
  ["m75","Messier 75","M75 · NGC 6864","c",301.52,-21.92,67500,9.2,"Globular cluster","Sagittarius"],
  ["m76","Little Dumbbell","M76 · NGC 650","n",25.58,51.58,2500,10.1,"Planetary nebula","Perseus"],
  ["m79","Messier 79","M79 · an adopted globular","c",81.05,-24.52,41000,8.6,"Globular cluster","Lepus"],
  ["m80","Messier 80","M80 · NGC 6093","c",244.26,-22.98,32600,7.9,"Globular cluster","Scorpius"],
  ["m81","Bode's Galaxy","M81 · grand-design neighbour","g",148.89,69.07,11800000,6.9,"Spiral galaxy","Ursa Major"],
  ["m84","Messier 84","M84 · Markarian's Chain","g",186.27,12.89,60000000,10.1,"Lenticular galaxy","Virgo"],
  ["m85","Messier 85","M85 · NGC 4382","g",186.35,18.19,60000000,10.0,"Lenticular galaxy","Coma Berenices"],
  ["m86","Messier 86","M86 · Markarian's Chain","g",186.55,12.95,52000000,9.8,"Lenticular galaxy","Virgo"],
  ["m88","Messier 88","M88 · NGC 4501","g",188.00,14.42,47000000,9.6,"Spiral galaxy","Coma Berenices"],
  ["m89","Messier 89","M89 · NGC 4552","g",188.92,12.56,50000000,9.8,"Elliptical galaxy","Virgo"],
  ["m90","Messier 90","M90 · NGC 4569","g",189.21,13.16,58700000,9.5,"Spiral galaxy","Virgo"],
  ["m91","Messier 91","M91 · Messier's lost object","g",188.86,14.50,63000000,10.2,"Barred spiral","Coma Berenices"],
  ["m92","Messier 92","M92 · Hercules' second jewel","c",259.28,43.14,26700,6.3,"Globular cluster","Hercules"],
  ["m93","Messier 93","M93 · NGC 2447","c",116.12,-23.85,3600,6.0,"Open cluster","Puppis"],
  ["m94","Croc's Eye Galaxy","M94 · starburst ring","g",192.72,41.12,16000000,8.2,"Spiral galaxy","Canes Venatici"],
  ["m97","Owl Nebula","M97 · NGC 3587","n",168.70,55.02,2030,9.9,"Planetary nebula","Ursa Major"],
  ["m98","Messier 98","M98 · NGC 4192","g",183.45,14.90,44400000,10.1,"Spiral galaxy","Coma Berenices"],
  ["m99","Coma Pinwheel","M99 · NGC 4254","g",184.71,14.42,50000000,9.9,"Spiral galaxy","Coma Berenices"],
  ["m100","Messier 100","M100 · NGC 4321","g",185.73,15.82,55000000,9.3,"Spiral galaxy","Coma Berenices"],
  ["m102","Spindle Galaxy","M102 · NGC 5866","g",226.62,55.76,50000000,9.9,"Lenticular galaxy","Draco"],
  ["m103","Messier 103","M103 · NGC 581","c",23.34,60.65,10000,7.4,"Open cluster","Cassiopeia"],
  ["m105","Messier 105","M105 · NGC 3379","g",161.96,12.58,32000000,10.2,"Elliptical galaxy","Leo"],
  ["m107","Messier 107","M107 · NGC 6171","c",248.13,-13.05,20900,8.9,"Globular cluster","Ophiuchus"],
  ["m108","Surfboard Galaxy","M108 · NGC 3556","g",167.88,55.67,46000000,10.7,"Barred spiral","Ursa Major"],
  ["m109","Messier 109","M109 · NGC 3992","g",179.40,53.37,83500000,10.6,"Barred spiral","Ursa Major"],
  ["m110","Messier 110","M110 · Andromeda's satellite","g",10.09,41.69,2690000,8.9,"Dwarf elliptical","Andromeda"]
  ];

  var T = { s: "star", c: "cluster", n: "nebula", g: "galaxy" };
  function colorFor(tK, sp) {
    if (tK === "n") return /dark/i.test(sp) ? "#9fa8da" : "#f48fb1";
    if (tK === "g") return "#dbe9ff";
    if (tK === "c") return /Globular/i.test(sp) ? "#ffe082" : "#bcd4ff";
    var L = (sp || "G").charAt(0).toUpperCase();
    var map = { O: "#bcd4ff", B: "#bcd4ff", A: "#dbe9ff", F: "#fff8e7", G: "#ffe082", K: "#ffcc80", M: "#ff8a65", W: "#bcd4ff", P: "#b39ddb", S: "#b39ddb", Q: "#b39ddb" };
    return map[L] || "#fff8e7";
  }
  function fmtLy(ly) {
    if (ly >= 1e9) return (ly / 1e9).toFixed(1) + " billion ly";
    if (ly >= 1e6) return (ly / 1e6).toFixed(1) + " million ly";
    if (ly >= 1000) return Math.round(ly).toLocaleString() + " ly";
    return ly + " ly";
  }
  function rarityFor(tK, mg, ly, sp) {
    if (/SMBH|Quasar|black hole|Pulsar/i.test(sp)) return "epic";
    var m = parseFloat(mg) || 6;
    if (tK === "s") return m <= 1.9 ? "rare" : m <= 3 ? "uncommon" : "common";
    if (tK === "g") return ly > 5e7 ? "rare" : "uncommon";
    return m <= 5 ? "rare" : "uncommon";
  }
  function factFor(tK, n, con, ly, sp) {
    if (tK === "s") return n + " burns " + fmtLy(ly) + " away in " + con + " — the light reaching your eye tonight left it " + (ly < 120 ? "within a human lifetime." : "before the telescope was invented.");
    if (tK === "c") return n + " is a " + sp.toLowerCase() + " in " + con + " — thousands of stars sharing one birthplace and one long voyage around the galaxy.";
    if (tK === "g") return n + " is an island universe beyond the Milky Way; its light is " + fmtLy(ly).replace(" ly", "") + " old when it arrives.";
    return n + " glows in " + con + " — a " + sp.toLowerCase() + " charted in the NGC2000.0 survey.";
  }
  var existing = {};
  if (!window.CELESTIAL) window.CELESTIAL = [];
  window.CELESTIAL.forEach(function (e) { existing[e.id] = 1; });
  X.forEach(function (r) {
    if (existing[r[0]]) return;
    var tK = r[3], mg = r[7], ly = r[6], sp = r[8], con = r[9];
    var mB = Math.max(0.03, Math.min(1, (6.5 - (parseFloat(mg) || 6)) / 8 + 0.15));
    var dB = Math.max(0.02, Math.min(1, Math.log10(ly + 2) / 10));
    window.CELESTIAL.push({
      id: r[0], n: r[1], d: r[2], t: T[tK] || "star", r: rarityFor(tK, mg, ly, sp),
      ra: r[4], dec: r[5], ly: ly, mg: String(mg), sp: sp, img: null, c: colorFor(tK, sp), con: con,
      st: [["Distance", fmtLy(ly), dB], ["Apparent mag", String(mg), mB], ["Spectral / class", sp, 0.5], ["Constellation", con, 0.5]],
      f: factFor(tK, r[1], con, ly, sp), lo: null,
    });
  });
  window.CELESTIAL_EXTRA_DONE = true;
})();

export {};
