(() => {
  const root = document.documentElement;
  const staticEn = new Map([
    ['.hero h1', 'Can I graduate<br><span class="hl">on time</span>?'],
    ['.hero .lede', 'Upload your grades. AI checks every course against the graduation requirements, plans your remaining semesters around your goals, and drafts questions for your department.'],
    ['.tabs legend', 'Choose how to add grades'],
    ['label[for="src-sample"] span', 'Sample student'], ['label[for="src-capture"] span', 'Upload image'], ['label[for="src-paste"] span', 'Paste text'],
    ['.pane-sample .tag', 'Sample'], ['.pane-sample .muted', '2023 entry year, two semesters on leave in 2025, now in the second semester of year 3. AI will read the sample grade screenshot.'],
    ['.pane-capture span', 'Drop your ON Kookmin grade screenshot here, or choose a file'], ['.pane-capture small', 'PNG, JPG, or WEBP, up to 5 images'],
    ['#viewSample', 'View sample grade screenshot'], ['#dropText', 'Drop your ON Kookmin grade screenshot here, or choose a file'],
    ['.pane-paste label', 'Grade text'], ['#paste', 'Select and copy your full ON Kookmin grade page, then paste it here'],
    ['.course-table th:nth-child(1)', 'Course'], ['.course-table th:nth-child(2)', 'Credits'], ['.course-table th:nth-child(3)', 'Type'], ['.course-table th:nth-child(4)', 'Grade'],
    ['.fields .field:first-child .field-label', 'Program'], ['.fields .field:first-child .field-static', 'Software major · 2023 entry'],
    ['label[for="year"]', 'Current year'], ['label[for="term"]', 'Semester'],
    ['.wish > .field-label', 'Your goals (optional, AI uses these in the plan)'],
    ['#wishes', 'Example: I want a career in web or security. I would like a lighter final semester.'],
    ['#flowTitle', 'How GraduationGak checks your progress'],
    ['[data-step="parse"] .fs-txt b', 'Read your transcript'], ['[data-step="parse"] .fs-txt small', 'AI turns the screenshot or text into a course table'],
    ['[data-step="judge"] .fs-txt b', 'Check 9 graduation requirements'], ['[data-step="judge"] .fs-txt small', 'The same grades always produce the same result'],
    ['[data-step="plan"] .fs-txt b', 'Plan your remaining semesters'], ['[data-step="plan"] .fs-txt small', 'Your goals shape the semester-by-semester plan'],
    ['[data-step="verify"] .fs-txt b', 'Verify the plan'], ['[data-step="verify"] .fs-txt small', 'If a rule fails, AI is asked to revise the plan'],
    ['.hero .btn-primary', 'Check my graduation plan'],
    ['#pwaInstall span', 'Install app'],
    ['.fine', 'Remove your name and student ID before uploading. Grades are not stored and are sent only to Google Gemini for analysis.'],
    ['#heroBadge', 'On track to graduate · Feb 2028'],
    ['.rc-who', 'Kim Kookmin so far'], ['.rc-big span', '/ 136 credits'], ['.rc-left', 'Only 52 credits left to graduate'],
    ['#heroFoot', 'Just 1 requirement left to resolve'],
    ['#rerun', 'Run diagnosis again'], ['.log-actions .muted', 'Select a cell to correct credits or course type, then run the diagnosis again.'],
    ['#ics', 'Add to calendar (.ics)'],
    ['#traceBox summary', 'AI plan verification details'], ['.replan .field-label', 'Want to try a different plan?'],
    ['#wishes2', 'Example: Focus on enterprise software courses and keep Spring of year 4 to about 15 credits.'],
    ['#replanGo', 'Build another plan with AI'],
    ['#consult-h', 'AI can draft an email to your department'],
    ['#consult .sec-lede', 'We selected questions that need a department decision or interpretation. AI drafts an email and meeting questions from these facts.'],
    ['#consultGo', 'Draft questions with AI'], ['.consult-out h3:first-child', 'Questions for your advisor'],
    ['.mail > h3', 'Email draft to the academic office'], ['label[for="mailSubject"]', 'Subject'],
    ['label[for="mailBody"]', 'Message ([name] and [student ID] should be filled in by you)'],
    ['#copyMail', 'Copy email'], ['#mailto', 'Open in email app'],
    ['.report h2', 'Bring this to your advisor'], ['.report p', 'Your diagnosis, next steps, semester plan, and deadlines in one printable report.'],
    ['#print', 'Print report / Save PDF'], ['.print-note', 'This result is for guidance only. Confirm your requirements with the department office.'],
    ['.top-login span', 'Log in'], ['#signupLink', 'Sign up'], ['#logoutBtn', 'Log out'],
    ['#sample-h', 'Kim Kookmin’s grade screenshot'], ['.sheet-head .tag', 'Sample student'],
    ['.paywall .tag', 'Your free demo is used'], ['#pay-h', 'One-semester pass'],
    ['.perks li:nth-child(1)', 'Unlimited diagnosis and reruns'], ['.perks li:nth-child(2)', 'AI course plan based on your goals'],
    ['.perks li:nth-child(3)', 'Calendar deadlines (.ics)'], ['.perks li:nth-child(4)', 'AI department email and advising report'],
    ['.paywall .muted', 'Available through February 28, 2027.'],
    ['.pay-actions button[value="pay"]', 'Try demo payment (no charge)'], ['.pay-actions button[value="cancel"]', 'Close'],
    ['.foot-links a:nth-child(1)', 'Terms of use'], ['.foot-links a:nth-child(2)', 'Privacy policy'], ['.foot-links a:nth-child(3)', 'Data sources'],
    ['.copy', '© 2026 GraduationGak · Made by Team 5'], ['#reset', 'Reset demo'],
  ]);
  const dynamicEn = new Map(Object.entries({
    '통과': 'Complete', '조치 필요': 'Needs attention', '진행 중': 'In progress', '학과 확인': 'Confirm with department',
    '필수 지정 과목': 'Required designated courses', '총 이수학점': 'Total credits', '핵심교양': 'Core liberal arts', '전공 (전공선택)': 'Major credits',
    '등록 학기': 'Registered semesters', '기초교양': 'Basic liberal arts', '자유교양': 'Elective liberal arts', '평점평균': 'GPA',
    '학부 인증, 졸업논문, 전공능력': 'Major certification, thesis, or competency', '전공선택': 'Major elective', '일반선택': 'Free elective',
    '필수': 'Required', '재수강': 'Retake', '지금 듣는 중': 'In progress', '수강 중': 'in progress', '휴학': 'Leave', '과목': 'courses', '학점': 'credits',
    '이수구분': 'Course type', '성적': 'Grade', '지정': 'designated', '계획': 'planned', '제외': 'excluded',
    '웹·정보보호 트랙 관심': 'Interested in web and security', 'AI·데이터 트랙 관심': 'Interested in AI and data',
    '마지막 학기는 가볍게': 'Keep the final semester light', '계절학기도 괜찮아요': 'Summer or winter courses are okay',
    '샘플 성적 화면 보기': 'View sample grade screenshot', '졸업요건': 'graduation requirements',
    '졸업까지': 'Until graduation', '남았어요': 'remaining', '가능': 'eligible', '초안': 'draft',
    '처리 중': 'Processing', '완료': 'Complete', '실패': 'Failed', '저장본 사용': 'Using saved sample',
    '학기당 19학점 이하': 'Up to 19 credits per semester', '이미 들은 과목 없음': 'No completed courses repeated',
    '부족한 요건 모두 채움': 'All missing requirements covered', '계획에서 해결': 'Addressed in plan',
    '부족': 'short', '학과 사무실에서 확인해 주세요.': 'Confirm with your department office.',
    '학사일정을 불러오지 못했어요': 'Could not load the academic calendar', '잠시 뒤 새로고침해 주세요.': 'Refresh and try again.',
    '무료 체험을 사용했어요': 'Free demo used', '무료 체험 1회 남음': '1 free demo remaining', '진행 중': 'In progress',
    '2학기 성적 공시 기간': 'Fall semester grade posting', '2학기 성적 이의신청/정정 기간': 'Fall grade appeal and correction period',
    '2027학년도 1학기 수강신청 기간': 'Spring 2027 course registration', '2027학년도 1학기 등록 기간': 'Spring 2027 tuition payment',
    '동계 계절학기 수강신청': 'Winter session course registration', '동계 계절학기 등록 기간': 'Winter session payment period',
    '동계 계절학기 수업 기간': 'Winter session classes', '2026학년도 전기 학위수여식': 'February 2027 commencement',
    '부족한 학점을 동계 계절학기로 채울 수 있어요.': 'You can make up missing credits during the winter session.',
    '수강신청만 하고 등록하지 않으면 계절학기를 들을 수 없어요.': 'You must pay after registering to attend the winter session.',
    '계절학기로 채울 학점이 있어요. 수업 기간을 미리 확인하세요.': 'Check the winter session dates for credits you need to make up.',
    '이번 학기 성적이 졸업 학점과 평점에 반영돼요. 공시되면 이수내역을 다시 진단해 보세요.': 'This semester affects your earned credits and GPA. Run the diagnosis again after grades are posted.',
    '성적이 잘못 입력됐다면 이 기간에만 정정을 요청할 수 있어요.': 'Request a correction during this period if a grade is incorrect.',
    '로드맵에서 다음 학기에 추천한 과목을 이 기간에 신청해야 해요.': 'Register for the courses recommended for next semester during this period.',
    '등록을 마쳐야 신청한 과목을 정상적으로 수강할 수 있어요.': 'Complete tuition payment to attend your registered courses.',
    '졸업 학기라면 이 학위수여식이 졸업 기준일이에요.': 'This is the graduation date if you are in your final semester.',
    '컴퓨터네트워크가 F예요. 1학기에만 열려서 2027-1학기에 꼭 다시 들어야 해요.': 'Computer Networks has an F. It is offered only in spring, so retake it in Spring 2027.',
    '계획대로면 2027-2학기에 136학점을 채워요.': 'You will reach 136 credits in Fall 2027 if you follow this plan.',
    '창의 영역 3학점이 비어 있어요. 2027-1학기 계획에 넣었어요.': 'You are missing 3 credits in the Creativity area. They are included in the Spring 2027 plan.',
    '지금 듣는 전공 13학점이 끝나면 통과해요.': 'You will meet this requirement after completing the 13 major credits in progress.',
    '지금 학기가 6학기째예요. 2027-2학기가 8학기째예요.': 'This is your 6th registered semester. Fall 2027 will be your 8th.',
    '지정 3과목을 모두 들었어요.': 'All three designated courses are complete.',
    '대학생활과진로 2학점으로 채웠어요.': 'Satisfied with 2 credits from College Life and Career.',
    '4.5 만점 기준이에요. P 과목은 빼고 F는 0점으로 넣었어요.': 'On a 4.5 scale. Pass grades are excluded and F counts as zero.',
    '자동으로 판정하지 않아요. 학과 사무실에서 확인해 주세요.': 'This cannot be checked automatically. Confirm with your department office.',
    '지금 듣는 학기예요. 끝나면 전공 66학점을 채워요.': 'You are taking these courses now. Completing them meets the 66-credit major requirement.',
    '컴퓨터네트워크와 캡스톤은 1학기에만 열려요. 학점이 꽉 차니 계절학기로 미리 덜어 두면 좋아요.': 'Computer Networks and Capstone are offered only in spring. Consider using the winter session to reduce your course load.',
    '남은 17학점을 채우면 총 136학점이 돼요.': 'Completing the remaining 17 credits brings you to 136 total.',
    '소프트웨어학부 2023학년도 입학생 졸업요건': 'Software major graduation requirements for 2023 entrants',
    '국민대 학사안내 졸업요건 (학사규정 제95조)': 'Kookmin academic regulations, Article 95',
    'English Conversation Ⅰ': 'English Conversation I', 'College English Ⅰ': 'College English I',
    '소프트웨어적사고': 'Computational Thinking', '소프트웨어프로젝트Ⅰ': 'Software Project I', '공학기초수학': 'Engineering Mathematics',
    '논리와비판적사고': 'Logic and Critical Thinking', '객체지향프로그래밍': 'Object-Oriented Programming', '응용통계학': 'Applied Statistics',
    '유레카프로젝트': 'Eureka Project', '선형대수': 'Linear Algebra', '소프트웨어프로젝트Ⅱ': 'Software Project II',
    '현대사회와윤리': 'Ethics in Modern Society', '자료구조': 'Data Structures', 'C++프로그래밍': 'C++ Programming',
    '논리회로설계': 'Logic Circuit Design', '웹클라이언트컴퓨팅': 'Web Client Computing', '말하기와토론': 'Speech and Debate',
    '대학생활과진로': 'College Life and Career', '이산수학': 'Discrete Mathematics', '컴퓨터구조': 'Computer Architecture',
    '모바일프로그래밍': 'Mobile Programming', '데이터과학': 'Data Science', '글로벌문화의이해': 'Understanding Global Culture',
    '경영학원론': 'Principles of Management', '운영체제': 'Operating Systems', '데이터베이스': 'Database Systems',
    '컴퓨터네트워크': 'Computer Networks', '프로그래밍언어론': 'Programming Languages', '심리학의이해': 'Introduction to Psychology',
    '알고리즘': 'Algorithms', '컴파일러': 'Compilers', '인공지능': 'Artificial Intelligence', '클라우드컴퓨팅': 'Cloud Computing',
    '마케팅원론': 'Principles of Marketing', '다학제간캡스톤디자인': 'Interdisciplinary Capstone Design',
    '핵심교양 창의 영역': 'Core liberal arts: Creativity', '소프트웨어공학': 'Software Engineering', '웹서버컴퓨팅': 'Web Server Computing',
    '소프트웨어의실제': 'Software Practice', '소프트웨어아키텍처': 'Software Architecture', '정보보호와시스템보안': 'Information and System Security',
    '소프트웨어융합최신기술': 'Emerging Software Convergence Technologies', '학부연구참여(UROP) Ⅱ': 'Undergraduate Research (UROP) II',
    '일반선택 2과목': 'Two free electives', 'SW 기술영어Ⅰ': 'Technical English for Software I', 'SW 기술영어Ⅱ': 'Technical English for Software II',
    'SW 기술영어Ⅲ': 'Technical English for Software III', '산업체특강': 'Industry Seminar', '인문Ⅰ': 'Humanities I',
    '인문Ⅱ': 'Humanities II', '소통': 'Communication', '창의': 'Creativity', '글로벌': 'Global',
    '글쓰기': 'Writing', '필수 지정 33학점': '33 designated required credits', '그 외 전공 24학점': '24 other major credits',
    '지금 듣는 16학점 포함 시 100학점': '100 credits including the 16 in progress', '휴학 2학기 제외': 'Excluding 2 semesters on leave',
    '84학점 기준': 'Based on 84 credits', '평점 3.5 이상이면 자동 인증': 'Automatically certified with a GPA of 3.5 or higher',
    '캡스톤 결과보고서': 'Capstone project report',
  }));

  const replaceText = (node) => {
    const original = node.nodeValue;
    const trimmed = original.trim();
    if (!trimmed || root.dataset.locale !== 'en') return;
    if (node.parentElement?.closest('.quote') && !node.parentElement.closest('.src')) return;
    if (dynamicEn.has(trimmed)) {
      node.nodeValue = original.replace(trimmed, dynamicEn.get(trimmed));
      return;
    }
    let next = original;
    for (const [ko, en] of dynamicEn) if (next.includes(ko)) next = next.replaceAll(ko, en);
    next = next.replace(/(\d+)학년 ([12])학기/g, 'Year $1 · Semester $2')
      .replace(/(\d+)학점/g, '$1 credits').replace(/(\d+)과목/g, '$1 courses')
      .replace(/(\d+)학기/g, 'Semester $1').replace(/([0-9.]+)\/([0-9.]+)credits/g, '$1 / $2 credits')
      .replace(/(\d{4})년 (\d{1,2})월 졸업 가능/g, 'Eligible to graduate in $2/$1')
      .replace(/(\d{4})년 (\d{1,2})월 졸업/g, 'Graduate · $2/$1')
      .replace(/([0-9]+)학점 부족/g, '$1 credits short');
    if (next !== original) node.nodeValue = next;
  };

  function translateDynamic(container = document.body) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) replaceText(walker.currentNode);
    if (root.dataset.locale !== 'en') return;
    document.querySelectorAll('option').forEach((option) => {
      const translated = dynamicEn.get(option.textContent.trim());
      if (translated) option.textContent = translated;
      else if (/^[1-4]학년$/.test(option.textContent)) option.textContent = `Year ${option.textContent[0]}`;
      else if (/^[12]학기$/.test(option.textContent)) option.textContent = `Semester ${option.textContent[0]}`;
    });
  }

  function applyLocale(locale) {
    const previousLocale = root.dataset.locale;
    root.dataset.locale = locale;
    root.lang = locale;
    try { localStorage.setItem('jg.locale', locale); } catch {}
    document.title = locale === 'en' ? 'GraduationGak · Graduation planner' : '졸업각';
    document.querySelector('meta[name="description"]').content = locale === 'en'
      ? 'Check Kookmin University Software major graduation requirements, plan your next semesters, and track deadlines.'
      : '성적 화면 한 장이면 국민대 소프트웨어학부 졸업요건과 대조해 부족한 것, 다음 학기 계획, 마감 일정을 알려 주는 졸업요건 진단 서비스';
    document.querySelector('#localeToggle').textContent = locale === 'ko' ? 'EN' : 'KO';
    document.querySelector('#localeToggle').setAttribute('aria-label', locale === 'ko' ? 'Switch to English' : '한국어로 전환');
    if (locale === 'ko') {
      if (previousLocale === 'en') location.reload();
      return;
    }
    document.querySelector('.brand').setAttribute('aria-label', locale === 'en' ? 'GraduationGak home' : '졸업각 처음으로');
    for (const [selector, text] of staticEn) {
      const elements = document.querySelectorAll(selector);
      if (!elements.length) continue;
      for (const el of elements) {
      if (selector === '.hero h1' || selector === '#log-h' || selector === '#checks-h' || selector === '#plan-h') {
        el.innerHTML = text;
        continue;
      }
      if (selector === '.hero .lede') {
        el.textContent = text;
        continue;
      }
      if (selector === '#paste' || selector === '#wishes' || selector === '#wishes2') { el.setAttribute('placeholder', text); continue; }
      if (selector === '.rc-left') {
        const value = el.querySelector('strong');
        el.replaceChildren(document.createTextNode('Only '), value, document.createTextNode(' left to graduate'));
        continue;
      }
      if (selector === '#heroFoot') { el.innerHTML = 'Just <strong>1</strong> requirement left to resolve'; continue; }
      if (selector === '.foot-grid > div:nth-child(2) p:first-child') {
        el.innerHTML = 'Data: <a href="https://cs.kookmin.ac.kr/major/graduated/13" target="_blank" rel="noopener">Software major 2023 graduation requirements</a>, <a href="https://www.kookmin.ac.kr/user/scGuid/scSchedule/index.do" target="_blank" rel="noopener">Kookmin academic calendar</a>';
        continue;
      }
      if (selector.endsWith('.step')) {
        const number = el.querySelector('span');
        el.replaceChildren(...(number ? [number, document.createTextNode(` ${text}`)] : [document.createTextNode(text)]));
        continue;
      }
      const textNode = [...el.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
      if (textNode) textNode.nodeValue = textNode.nodeValue.replace(textNode.nodeValue.trim(), text);
      else if (el.children.length) el.append(document.createTextNode(text));
      else el.textContent = text;
      }
    }
    const stepNames = ['Credits completed so far', 'Graduation requirements', 'Your path to graduation', 'Important deadlines', 'Questions for your department'];
    document.querySelectorAll('.step').forEach((el, i) => {
      const number = el.querySelector('span');
      if (number) el.replaceChildren(number, document.createTextNode(` ${stepNames[i]}`));
    });
    const verified = ['No completed courses repeated', 'Up to 19 credits per semester', 'All missing requirements covered'];
    document.querySelectorAll('.verified li').forEach((el, i) => {
      const icon = el.querySelector('i');
      el.replaceChildren(...(icon ? [icon, document.createTextNode(` ${verified[i]}`)] : [document.createTextNode(verified[i])]));
    });
    const legend = ['1 credit', '2 credits', '3 credits', 'F', 'In progress'];
    document.querySelectorAll('.legend span').forEach((el, i) => {
      const swatch = el.querySelector('i');
      el.replaceChildren(...(swatch ? [swatch, document.createTextNode(` ${legend[i]}`)] : [document.createTextNode(legend[i])]));
    });
    document.querySelectorAll('.brand-logo img').forEach((img) => img.alt = '졸업각');
    document.querySelectorAll('.pane-sample strong').forEach((el) => { el.textContent = 'Kim Kookmin'; });
    document.querySelector('#pwaInstall').setAttribute('aria-label', 'Install GraduationGak');
    document.querySelector('[role="group"]').setAttribute('aria-label', 'Language settings');
    document.querySelector('#themeToggle').setAttribute('aria-label', root.dataset.locale === 'en'
      ? (root.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')
      : (root.dataset.theme === 'dark' ? '라이트 모드로 바꾸기' : '다크 모드로 바꾸기'));
    translateDynamic();
  }

  applyLocale(root.dataset.locale === 'en' ? 'en' : 'ko');
  document.querySelector('#localeToggle').addEventListener('click', () => applyLocale(root.dataset.locale === 'ko' ? 'en' : 'ko'));

  let installPrompt;
  const installButton = document.querySelector('#pwaInstall');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  installButton.hidden = standalone;
  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) {
      const message = root.dataset.locale === 'en'
        ? 'To install, open your browser menu and choose “Add to Home Screen” or “Install app”.'
        : '설치하려면 브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해 주세요.';
      alert(message);
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });
  addEventListener('appinstalled', () => { installButton.hidden = true; });

  const observer = new MutationObserver((records) => {
    if (root.dataset.locale !== 'en') return;
    for (const record of records) {
      if (record.type === 'characterData') replaceText(record.target);
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) translateDynamic(node);
        else if (node.nodeType === Node.TEXT_NODE) replaceText(node);
      }
    }
  });
  observer.observe(document.body, { subtree: true, childList: true });
})();