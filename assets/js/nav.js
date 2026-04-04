window.setAdminNavVisibility = function (roleName) {
  document.querySelectorAll('[data-admin-only="true"]').forEach((el) => el.classList.toggle('hidden', roleName !== 'admin'));
};
