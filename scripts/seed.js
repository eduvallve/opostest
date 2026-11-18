const supabase = require('../db');

async function seed() {
  console.log('--- Iniciant Càrrega de Dades de Prova (Seed) ---');

  // Netejar taules anteriors de prova per evitar duplicats
  console.log('1. Netejant dades prèvies...');
  await supabase.from('courses').delete().neq('id', 0);
  await supabase.from('questions').delete().neq('id', 0);

  // 1. Cursos
  console.log('2. Inserint cursos...');
  const { data: courses, error: cErr } = await supabase
    .from('courses')
    .insert([
      {
        title: 'Tècnic de Gestió de la Generalitat',
        description: 'Convocatòria d\'accés al cos de gestió d\'administració general (Grup A2).'
      },
      {
        title: 'Administratiu Educatiu',
        description: 'Convocatòria per al cos administratiu del departament d\'educació (Grup C1).'
      }
    ])
    .select();

  if (cErr) throw cErr;
  console.log(`  ✓ Creats ${courses.length} cursos.`);

  const cGestio = courses[0];
  const cEducatiu = courses[1];

  // 2. Lliçons
  console.log('3. Inserint lliçons amb contingut Markdown...');
  const { data: lessons, error: lErr } = await supabase
    .from('lessons')
    .insert([
      {
        course_id: cGestio.id,
        title: 'Tema 1: La Constitució Espanyola de 1978',
        order_index: 1,
        completed: false,
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        content: `# La Constitució Espanyola de 1978

## 1. Principis Fonamentals
Espanya es constitueix en un **Estat social i democràtic de Dret**, que propugna com a valors superiors del seu ordenament jurídic:
- La llibertat
- La justícia
- La igualtat
- El pluralisme polític

> **Article 1.2 CE**: *La sobirania nacional resideix en el poble espanyol, del qual emanen els poders de l'Estat.*`
      },
      {
        course_id: cGestio.id,
        title: 'Tema 2: L\'Estatut d\'Autonomia de Catalunya',
        order_index: 2,
        completed: false,
        content: `# L'Estatut d'Autonomia de Catalunya de 2006

## 1. Marc Institucional
La Generalitat és el sistema institucional en què s'organitza políticament l'autogovern de Catalunya.

### Institucions principals:
1. El Parlament de Catalunya
2. La Presidència de la Generalitat
3. El Govern o Consell Executiu`
      },
      {
        course_id: cEducatiu.id,
        title: 'Tema 1: Marc Constitucional i Organització Territorial',
        order_index: 1,
        completed: false,
        content: `# Marc Constitucional Comú

## Organització Territorial de l'Estat
L'Estat s'organitza territorialment en:
- Municipis
- Províncies
- Comunitats Autònomes que es constitueixin`
      },
      {
        course_id: cEducatiu.id,
        title: 'Tema 2: El Procediment Administratiu Comú (Llei 39/2015)',
        order_index: 2,
        completed: false,
        content: `# Llei 39/2015, d'1 d'octubre

## Fases del procediment:
- **Iniciació**: D'ofici o a sol·licitud de persona interessada.
- **Ordenació**: Expedient electrònic i celeritat.
- **Instrucció**: Al·legacions, informes i proves.
- **Finalització**: Resolució expressa, desistiment, renúncia o caducitat.`
      }
    ])
    .select();

  if (lErr) throw lErr;
  console.log(`  ✓ Creades ${lessons.length} lliçons.`);

  const [lGestio1, lGestio2, lEdu1, lEdu2] = lessons;

  // 3. Preguntes test
  console.log('4. Inserint preguntes test transversals...');
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .insert([
      {
        question_text: 'Segons l\'article 1.2 de la Constitució Espanyola, en qui resideix la sobirania nacional?',
        option_a: 'En el poble espanyol',
        option_b: 'En les Corts Generals',
        option_c: 'En el Rei com a Cap d\'Estat',
        option_d: 'En el Govern de la Nació',
        correct_option: 'A',
        explanation: 'Article 1.2 CE: La sobirania nacional resideix en el poble espanyol, del qual emanen els poders de l\'Estat.',
        difficulty: 'facil'
      },
      {
        question_text: 'Quin títol de la Constitució Espanyola està dedicat als Drets i Deures Fonamentals?',
        option_a: 'Títol Preliminar',
        option_b: 'Títol I',
        option_c: 'Títol II',
        option_d: 'Títol III',
        correct_option: 'B',
        explanation: 'El Títol I de la Constitució (articles 10 a 55) regula els Drets i Deures Fonamentals.',
        difficulty: 'facil'
      },
      {
        question_text: 'Quin article de l\'Estatut d\'Autonomia defineix que la Generalitat és el sistema institucional d\'autogovern de Catalunya?',
        option_a: 'Article 1',
        option_b: 'Article 10',
        option_c: 'Article 2',
        option_d: 'Article 5',
        correct_option: 'C',
        explanation: 'L\'article 2 de l\'EAC defineix la naturalesa de la Generalitat com a sistema institucional.',
        difficulty: 'mitjana'
      },
      {
        question_text: 'Segons la Llei 39/2015, quin és el termini general màxim per resoldre i notificar si la norma reguladora no en fixa un?',
        option_a: '1 mes',
        option_b: '3 mesos',
        option_c: '6 mesos',
        option_d: '1 any',
        correct_option: 'B',
        explanation: 'Article 21.3 de la Llei 39/2015: Quan les normes reguladores no fixin termini, aquest és de tres mesos.',
        difficulty: 'mitjana'
      },
      {
        question_text: 'Quina majoria és necessària al Congrés dels Diputats per a l\'aprovació o modificació d\'una llei orgànica?',
        option_a: 'Majoria absoluta en una votació final sobre el conjunt del projecte',
        option_b: 'Majoria simple dels membres presents',
        option_c: 'Majoria de 3/5 parts dels diputats',
        option_d: 'Majoria de 2/3 parts del Senat',
        correct_option: 'A',
        explanation: 'Article 81.2 CE: L\'aprovació, modificació o derogació de les lleis orgàniques exigeix majoria absoluta del Congrés.',
        difficulty: 'dificil'
      },
      {
        question_text: 'Quin recurs administratiu es pot interposar davant del superior jeràrquic contra un acte que no posa fi a la via administrativa?',
        option_a: 'Recurs d\'alçada',
        option_b: 'Recurs potestatiu de reposició',
        option_c: 'Recurs extraordinari de revisió',
        option_d: 'Recurs contenciós administratiu',
        correct_option: 'A',
        explanation: 'Article 121 de la Llei 39/2015: Les resolucions que no posen fi a la via administrativa poden ser recorregudes en alçada.',
        difficulty: 'mitjana'
      }
    ])
    .select();

  if (qErr) throw qErr;
  console.log(`  ✓ Creades ${questions.length} preguntes.`);

  // 4. Relacions N:M (Lliçons <-> Preguntes)
  console.log('5. Vinculant preguntes a lliçons (Relacions N:M transversals)...');
  const lqRows = [
    // Q1 (Constitució) vinculada a Tema 1 Gestió i Tema 1 Educatiu
    { lesson_id: lGestio1.id, question_id: questions[0].id },
    { lesson_id: lEdu1.id, question_id: questions[0].id },

    // Q2 (Drets Fonamentals) vinculada a Tema 1 Gestió i Tema 1 Educatiu
    { lesson_id: lGestio1.id, question_id: questions[1].id },
    { lesson_id: lEdu1.id, question_id: questions[1].id },

    // Q3 (Estatut) vinculada a Tema 2 Gestió
    { lesson_id: lGestio2.id, question_id: questions[2].id },

    // Q4 (Procediment 3 mesos) vinculada a Tema 2 Educatiu
    { lesson_id: lEdu2.id, question_id: questions[3].id },

    // Q5 (Lleis orgàniques) transversal: Tema 1 Gestió, Tema 2 Gestió i Tema 1 Educatiu!
    { lesson_id: lGestio1.id, question_id: questions[4].id },
    { lesson_id: lGestio2.id, question_id: questions[4].id },
    { lesson_id: lEdu1.id, question_id: questions[4].id },

    // Q6 (Recurs d'alçada) vinculada a Tema 2 Educatiu
    { lesson_id: lEdu2.id, question_id: questions[5].id }
  ];

  const { error: lqErr } = await supabase.from('lesson_questions').insert(lqRows);
  if (lqErr) throw lqErr;
  console.log(`  ✓ Creades ${lqRows.length} associacions a lesson_questions.`);

  console.log('✅ Seed completat amb èxit!');
}

seed().catch(err => {
  console.error('❌ Error en el seed:', err.message);
  process.exit(1);
});

