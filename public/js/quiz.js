// quiz.js - Lògica interactiva per al simulacre de quiz

document.addEventListener('DOMContentLoaded', () => {
  const quizForm = document.getElementById('quiz-form');
  if (!quizForm) return;

  const radios = document.querySelectorAll('.quiz-radio');
  const counterEl = document.getElementById('answered-counter');
  const questionCards = document.querySelectorAll('.question-card');
  const totalQuestions = questionCards.length;

  function updateCounter() {
    const answeredCards = new Set();
    radios.forEach(radio => {
      if (radio.checked) {
        answeredCards.add(radio.getAttribute('data-qid'));
      }
    });

    if (counterEl) {
      counterEl.textContent = answeredCards.size;
    }
    return answeredCards.size;
  }

  // Marcatge visual de l'opció seleccionada
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      const qid = radio.getAttribute('data-qid');
      const card = document.getElementById(`q-card-${qid}`);
      if (card) {
        card.querySelectorAll('.option-label').forEach(label => {
          label.classList.remove('selected');
        });
        const currentLabel = radio.closest('.option-label');
        if (currentLabel) {
          currentLabel.classList.add('selected');
        }
      }
      updateCounter();
    });
  });

  // Confirmació abans d'enviar si queden preguntes pendents
  quizForm.addEventListener('submit', (e) => {
    const answeredCount = updateCounter();
    if (answeredCount < totalQuestions) {
      const unanswered = totalQuestions - answeredCount;
      const confirmSubmit = confirm(
        `Tens ${unanswered} pregunta/es sense respondre de ${totalQuestions}.\n\nSegur que vols finalitzar el simulacre ara? Les preguntes sense contestar comptaran com a incorrectes.`
      );
      if (!confirmSubmit) {
        e.preventDefault();
      }
    }
  });

  // Inicialitzar comptador a la càrrega
  updateCounter();
});
