import { Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Global()
@Module({
  providers: [
    {
      provide: Reflector,
      useClass: Reflector,
    },
  ],
  exports: [Reflector],
})
export class ReflectorModule {}

