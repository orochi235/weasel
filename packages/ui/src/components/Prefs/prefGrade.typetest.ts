import type { PrefGrade } from '@weasel-js/prefs';
import type { Grade } from '../appearance';

// prefs spells out theme's grades, being unable to depend on theme: the two must stay one set.
const toGrade = (grade: PrefGrade): Grade => grade;
const toPrefGrade = (grade: Grade): PrefGrade => grade;
void toGrade;
void toPrefGrade;
