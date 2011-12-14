#!/usr/bin/python
# use external/node/run_tests.py

import os
import subprocess
import sys
import re
import time

if len(sys.argv) < 3:
  print ('usage: $> ' + sys.argv[0] + ' target <Path> <match (optional)>');
  print ('eg.    $> ' + sys.argv[0] + ' browser test/simple http');
  sys.exit();

if len(sys.argv) >= 3:
  Path = sys.argv[2];

if len(sys.argv) >= 4:
  match = sys.argv[3];
else:
  match = r'(\w*)'

target = sys.argv[1]
if target != 'shell' and target != 'desktop' and target != 'browser':
   print 'invalid target: ' + target + ' should be one of <shell/desktop/browser>'
   sys.exit()

StartTime = time.time()

if target == 'browser':
   TestsPerInvocation = 1
else:
   TestsPerInvocation = 1

# check for skip file
skipfile = Path + '/skip.browser'
SkipList = []
SingleList = []

try:
  ins = open( skipfile, "r" )
  for line in ins:
    if not line.startswith('#') and line.strip():
      if line.startswith('^'):
        TestSingle = line.strip()[1:]
        SingleList.append(TestSingle)
      else:
        SkipList.append(line.strip())
except IOError as (errno, strerror):
    print skipfile + ": I/O error({0}): {1}".format(errno, strerror)
    print 'Warning: No skip file provided, running all tests'

#Listing = os.listdir(os.getcwd() + '/' +  Path)
Listing = os.listdir(Path)
Listing.sort()

TestsToRun = []
for Test in Listing:
   if not Test in SkipList and re.search(match, Test) and re.match(r'.*\.js$', Test):
       TestsToRun.append(Test);

# print testtorun
print "TESTRUN: Total tests: " + str(len(Listing))
print "TESTRUN: Tests to run multiple : " + str(len(TestsToRun))
print "TESTRUN: Tests to run single: " + str(len(SingleList))
print "TESTRUN: Tests skipped: " + str(len(SkipList))
print "TESTRUN: Tests to run per invocation: " + str(TestsPerInvocation)

toolsdir = os.path.dirname(sys.argv[0])
TestString = ''
Count = 0
TotalCount = 0

def runTest(TestString):
  if target == 'desktop':
    print "TESTSTR (desktop): ./node " + TestString
    sys.stdout.flush()
    retcode = subprocess.Popen(['./node ' + TestString], shell=True).wait()
    if retcode < 0:
      print "Test ** CRASHED **: " + TestString
  elif target == 'shell':
    # shell=True is required to split the arguments to the shell
    # adb shell node "a.js b.js" vs adb shell node "a.js" "b.js" (correct one)
    print "TESTSTR (shell): adb shell node " + TestString
    sys.stdout.flush()
    retcode = subprocess.Popen(['adb shell node ' + TestString], shell=True).wait()
    if retcode < 0:
      print "Test ** CRASHED **: " + TestString
  elif target == 'browser':
    print "TESTSTR (browser): ./node " + TestString
    sys.stdout.flush()
    subprocess.Popen(['sh', toolsdir + '/' + 'node_browser.sh', TestString]).wait()

for Test in TestsToRun:
  TotalCount = TotalCount + 1
  TestPath = Path + '/' + Test;
  if re.search('http', Test) or Test in SingleList:
    runTest(TestPath);
  else:
    if Count == TestsPerInvocation or TotalCount == len(TestsToRun):
      runTest(TestString)
      TestString = '';
      Count = 0;
      sys.stdout.flush()
    else:
      TestString += TestPath + " "
      Count = Count + 1

print "TESTRUN: Total tests: " + str(len(Listing))
print "TESTRUN: Tests to run multiple : " + str(len(TestsToRun))
print "TESTRUN: Tests skipped: " + str(len(SkipList))
print "TESTRUN: Tests run per invocation: " + str(TestsPerInvocation)
print "TESTRUN: Time to run tests: " + str( int(time.time() - StartTime)) + "s"
