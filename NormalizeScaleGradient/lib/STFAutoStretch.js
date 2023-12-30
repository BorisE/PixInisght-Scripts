//
// Code written by Juan Conejero, modified by John Murphy to calculate instead of apply
// See https://pixinsight.com/forum/index.php?threads/programmatic-way-to-do-an-stf-autostretch.6659/
//
/*
 * Default STF Parameters
 */
/* global DEFAULT_AUTOSTRETCH_SCLIP, DEFAULT_AUTOSTRETCH_TBGND, DEFAULT_AUTOSTRETCH_CLINK */

/*
 * STF Auto Stretch routine
 */
function STFAutoStretch( view, shadowsClipping, targetBackground, rgbLinked )
{
   if (view.isNull){
       return [ // c0, c1, m, r0, r1
       [0, 1, 0.5, 0, 1],
       [0, 1, 0.5, 0, 1],
       [0, 1, 0.5, 0, 1],
       [0, 1, 0.5, 0, 1] ];
   }
   if ( shadowsClipping === undefined )
      shadowsClipping = DEFAULT_AUTOSTRETCH_SCLIP;
   if ( targetBackground === undefined )
      targetBackground = DEFAULT_AUTOSTRETCH_TBGND;
   if ( rgbLinked === undefined )
      rgbLinked = DEFAULT_AUTOSTRETCH_CLINK;
   
//   let stf = new ScreenTransferFunction;
   let STF;

   let n = view.image.isColor ? 3 : 1;

   let median = view.computeOrFetchProperty( "Median" );

   let mad = view.computeOrFetchProperty( "MAD" );
   mad.mul( 1.4826 ); // coherent with a normal distribution

   if ( rgbLinked )
   {
      /*
       * Try to find how many channels look as channels of an inverted image.
       * We know a channel has been inverted because the main histogram peak is
       * located over the right-hand half of the histogram. Seems simplistic
       * but this is consistent with astronomical images.
       */
      let invertedChannels = 0;
      for ( let c = 0; c < n; ++c )
         if ( median.at( c ) > 0.5 )
            ++invertedChannels;

      if ( invertedChannels < n )
      {
         /*
          * Noninverted image
          */
         let c0 = 0, m = 0;
         for ( let c = 0; c < n; ++c )
         {
            if ( 1 + mad.at( c ) !== 1 )
               c0 += median.at( c ) + shadowsClipping * mad.at( c );
            m  += median.at( c );
         }
         c0 = Math.range( c0/n, 0.0, 1.0 );
         m = Math.mtf( targetBackground, m/n - c0 );

         STF = [ // c0, c1, m, r0, r1
                     [c0, 1, m, 0, 1],
                     [c0, 1, m, 0, 1],
                     [c0, 1, m, 0, 1],
                     [0, 1, 0.5, 0, 1] ];
      }
      else
      {
         /*
          * Inverted image
          */
         let c1 = 0, m = 0;
         for ( let c = 0; c < n; ++c )
         {
            m  += median.at( c );
            if ( 1 + mad.at( c ) !== 1 )
               c1 += median.at( c ) - shadowsClipping * mad.at( c );
            else
               c1 += 1;
         }
         c1 = Math.range( c1/n, 0.0, 1.0 );
         m = Math.mtf( c1 - m/n, targetBackground );

         STF = [ // c0, c1, m, r0, r1
                     [0, c1, m, 0, 1],
                     [0, c1, m, 0, 1],
                     [0, c1, m, 0, 1],
                     [0, 1, 0.5, 0, 1] ];
      }
   }
   else
   {
      /*
       * Unlinked RGB channnels: Compute automatic stretch functions for
       * individual RGB channels separately.
       */
      let A = [ // c0, c1, m, r0, r1
               [0, 1, 0.5, 0, 1],
               [0, 1, 0.5, 0, 1],
               [0, 1, 0.5, 0, 1],
               [0, 1, 0.5, 0, 1] ];

      for ( let c = 0; c < n; ++c )
      {
         if ( median.at( c ) < 0.5 )
         {
            /*
             * Noninverted channel
             */
            let c0 = (1 + mad.at( c ) !== 1) ? Math.range( median.at( c ) + shadowsClipping * mad.at( c ), 0.0, 1.0 ) : 0.0;
            let m  = Math.mtf( targetBackground, median.at( c ) - c0 );
            A[c] = [c0, 1, m, 0, 1];
         }
         else
         {
            /*
             * Inverted channel
             */
            let c1 = (1 + mad.at( c ) !== 1) ? Math.range( median.at( c ) - shadowsClipping * mad.at( c ), 0.0, 1.0 ) : 1.0;
            let m  = Math.mtf( c1 - median.at( c ), targetBackground );
            A[c] = [0, c1, m, 0, 1];
         }
      }

      STF = A;
   }

//   console.writeln( "<end><cbr/><b>", view.fullId, "</b>:" );
//   for ( let c = 0; c < n; ++c )
//   {
//      console.writeln( "channel #", c );
//      console.writeln( format( "c0 = %.6f", STF[c][0] ) );
//      console.writeln( format( "m  = %.6f", STF[c][2] ) );
//      console.writeln( format( "c1 = %.6f", STF[c][1] ) );
//   }
//   // stf.executeOn( view );
//   console.writeln( "<end><cbr/>" );
   
   return STF;
}
