find . -name 'eio.o' |xargs rm
find . -name 'uv.a' |xargs rm
echo "//" >> src/node_timer.cc
make
