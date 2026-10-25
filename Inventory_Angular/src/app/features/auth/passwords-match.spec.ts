import { FormControl, FormGroup } from '@angular/forms';
import { passwordsMatch } from './passwords-match';

// TODO(C2) : retire `.skip` une fois passwordsMatch implémenté.
describe.skip('passwordsMatch', () => {
  const group = (password: string, confirm: string) =>
    new FormGroup(
      { password: new FormControl(password), confirm: new FormControl(confirm) },
      { validators: passwordsMatch },
    );

  it('accepts identical passwords', () => {
    expect(group('secret123', 'secret123').errors).toBeNull();
  });

  it('reports different passwords on the group', () => {
    expect(group('secret123', 'secret124').errors).toEqual({ passwordsMismatch: true });
  });
});
