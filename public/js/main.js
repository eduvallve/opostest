// main.js - Lògica d'interacció client per a OposTest

document.addEventListener('DOMContentLoaded', () => {
  // 1. Filtre instantani en viu de l'arbre jeràrquic de lliçons
  const treeFilterInput = document.getElementById('tree-filter-input');
  if (treeFilterInput) {
    treeFilterInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      const courseNodes = document.querySelectorAll('.course-node');

      courseNodes.forEach(node => {
        const lessonItems = node.querySelectorAll('.lesson-item');
        let anyVisible = false;

        lessonItems.forEach(item => {
          const title = item.getAttribute('data-lesson-title') || item.textContent.toLowerCase();
          if (!term || title.includes(term)) {
            item.style.display = 'flex';
            anyVisible = true;
          } else {
            item.style.display = 'none';
          }
        });

        // Mostrar o amagar el bloc del curs sencer si coincideix o si té lliçons visibles
        const courseTitle = node.querySelector('.course-node__header')?.textContent.toLowerCase() || '';
        if (anyVisible || courseTitle.includes(term)) {
          node.style.display = 'block';
          if (courseTitle.includes(term)) {
            lessonItems.forEach(i => i.style.display = 'flex');
          }
        } else {
          node.style.display = 'none';
        }
      });
    });
  }

  // 2. Botons ràpids per bloc ("Seleccionar tot el curs" / "Desmarcar tot")
  document.querySelectorAll('.btn-select-all').forEach(btn => {
    btn.addEventListener('click', () => {
      const courseId = btn.getAttribute('data-course-id');
      const checkboxes = document.querySelectorAll(`.course-lesson-checkbox[data-course-id="${courseId}"]`);
      checkboxes.forEach(cb => {
        // Només marcar si l'element és visible pel filtre actual
        const item = cb.closest('.lesson-item');
        if (!item || item.style.display !== 'none') {
          cb.checked = true;
        }
      });
    });
  });

  document.querySelectorAll('.btn-deselect-all').forEach(btn => {
    btn.addEventListener('click', () => {
      const courseId = btn.getAttribute('data-course-id');
      const checkboxes = document.querySelectorAll(`.course-lesson-checkbox[data-course-id="${courseId}"]`);
      checkboxes.forEach(cb => {
        cb.checked = false;
      });
    });
  });
});

